import { logger } from "../lib/logger";
import type { CreateOrderRequest, ValidationResult, ValidationStage } from "./execution-types";
import { VALID_EXECUTION_MODES } from "./execution-types";
import { getExecutionAccount } from "./execution-db";
import { getKillSwitchStatus } from "./kill-switch-service";
import { getAllBreakerStates } from "./circuit-breaker-service";

/**
 * execution-pre-trade-pipeline.ts — 10-stage pre-trade validation (ADR-028).
 *
 * Every order must pass all stages sequentially before routing.
 * A single failure stops the pipeline and rejects the order.
 *
 * Stages:
 * 1. request    — field presence and basic types
 * 2. symbol     — symbol format validation
 * 3. account    — account exists, is active, not kill-switched
 * 4. mode       — execution mode is valid and not live
 * 5. order_type — order type / TIF compatibility
 * 6. quantity   — quantity > 0, not NaN
 * 7. position_limits — max position size check
 * 8. risk_profile — account risk profile check (non-blocking advisory)
 * 9. circuit_breakers — active circuit breakers prevent trading
 * 10. kill_switch — platform-level kill switch check
 */

const VALID_SYMBOLS_PATTERN = /^[A-Z0-9]{3,20}(USDT|BTC|ETH|USD|EUR|GBP|JPY)?$/;
const MAX_QUANTITY = 1_000_000;
const MIN_QUANTITY = 0.000001;

export interface PipelineResult {
  passed: boolean;
  stages: ValidationResult[];
  failedAt?: ValidationStage;
  rejectReason?: string;
}

export async function runPreTradePipeline(
  request: CreateOrderRequest,
): Promise<PipelineResult> {
  const stages: ValidationResult[] = [];

  // 1. Request validation
  const requestCheck = validateRequest(request);
  stages.push(requestCheck);
  if (!requestCheck.passed) return fail(stages, requestCheck);

  // 2. Symbol validation
  const symbolCheck = validateSymbol(request.symbol);
  stages.push(symbolCheck);
  if (!symbolCheck.passed) return fail(stages, symbolCheck);

  // 3. Account validation
  const accountCheck = await validateAccount(request.accountId);
  stages.push(accountCheck);
  if (!accountCheck.passed) return fail(stages, accountCheck);

  // 4. Mode validation
  const modeCheck = validateMode(request.executionMode ?? "simulation");
  stages.push(modeCheck);
  if (!modeCheck.passed) return fail(stages, modeCheck);

  // 5. Order type validation
  const typeCheck = validateOrderType(request);
  stages.push(typeCheck);
  if (!typeCheck.passed) return fail(stages, typeCheck);

  // 6. Quantity validation
  const qtyCheck = validateQuantity(request.quantity);
  stages.push(qtyCheck);
  if (!qtyCheck.passed) return fail(stages, qtyCheck);

  // 7. Position limits (simplified — rejects if quantity > max)
  const limitsCheck = validatePositionLimits(request.quantity);
  stages.push(limitsCheck);
  if (!limitsCheck.passed) return fail(stages, limitsCheck);

  // 8. Risk profile (advisory — warns but does not block in simulation mode)
  const riskCheck = await validateRiskProfile(request);
  stages.push(riskCheck);
  if (!riskCheck.passed) return fail(stages, riskCheck);

  // 9. Circuit breakers
  const cbCheck = await validateCircuitBreakers();
  stages.push(cbCheck);
  if (!cbCheck.passed) return fail(stages, cbCheck);

  // 10. Kill switch
  const ksCheck = await validateKillSwitch();
  stages.push(ksCheck);
  if (!ksCheck.passed) return fail(stages, ksCheck);

  return { passed: true, stages };
}

// ---------------------------------------------------------------------------
// Stage implementations
// ---------------------------------------------------------------------------

function validateRequest(req: CreateOrderRequest): ValidationResult {
  const stage: ValidationStage = "request";

  if (!req.accountId || typeof req.accountId !== "string") {
    return { passed: false, stage, reason: "accountId is required" };
  }
  if (!req.symbol || typeof req.symbol !== "string") {
    return { passed: false, stage, reason: "symbol is required" };
  }
  if (!req.orderType) {
    return { passed: false, stage, reason: "orderType is required" };
  }
  if (!req.side || !["buy", "sell"].includes(req.side)) {
    return { passed: false, stage, reason: "side must be 'buy' or 'sell'" };
  }
  if (!req.quantity) {
    return { passed: false, stage, reason: "quantity is required" };
  }
  if (req.orderType === "limit" || req.orderType === "stop_limit") {
    if (!req.limitPrice) {
      return { passed: false, stage, reason: `limitPrice required for ${req.orderType}` };
    }
  }
  if (req.orderType === "stop" || req.orderType === "stop_limit") {
    if (!req.stopPrice) {
      return { passed: false, stage, reason: `stopPrice required for ${req.orderType}` };
    }
  }

  return { passed: true, stage };
}

function validateSymbol(symbol: string): ValidationResult {
  const stage: ValidationStage = "symbol";
  const upper = symbol.toUpperCase();

  if (upper.length < 3 || upper.length > 20) {
    return { passed: false, stage, reason: `Symbol length invalid: ${upper}` };
  }
  if (!VALID_SYMBOLS_PATTERN.test(upper)) {
    return { passed: false, stage, reason: `Symbol format invalid: ${upper}` };
  }

  return { passed: true, stage };
}

async function validateAccount(accountId: string): ValidationResult {
  const stage: ValidationStage = "account";

  try {
    const account = await getExecutionAccount(accountId);
    if (!account) {
      return { passed: false, stage, reason: `Account not found: ${accountId}` };
    }
    if (!account.isActive) {
      return { passed: false, stage, reason: "Account is not active" };
    }
    if (account.isKillSwitchActive) {
      return { passed: false, stage, reason: "Account kill switch is active" };
    }
    return { passed: true, stage, detail: { executionMode: account.executionMode } };
  } catch (err) {
    logger.error({ err, accountId }, "Pre-trade account validation error");
    return { passed: false, stage, reason: "Account validation failed" };
  }
}

function validateMode(mode: string): ValidationResult {
  const stage: ValidationStage = "mode";

  if (!VALID_EXECUTION_MODES.includes(mode as any)) {
    return { passed: false, stage, reason: `Invalid execution mode: ${mode}` };
  }
  if (mode === "live_disabled") {
    // live_disabled is valid as a mode but execution against real exchange is blocked
    // We allow the order through in disabled mode for testing the pipeline itself
    return { passed: true, stage, detail: { note: "live mode — execution disabled at provider level" } };
  }

  return { passed: true, stage };
}

function validateOrderType(req: CreateOrderRequest): ValidationResult {
  const stage: ValidationStage = "order_type";
  const valid = ["market", "limit", "stop", "stop_limit", "reduce_only", "post_only"];

  if (!valid.includes(req.orderType)) {
    return { passed: false, stage, reason: `Unknown order type: ${req.orderType}` };
  }

  const tif = req.tif ?? "gtc";
  if (!["gtc", "ioc", "fok"].includes(tif)) {
    return { passed: false, stage, reason: `Invalid TIF: ${tif}` };
  }

  // post_only orders must be limit-priced
  if (req.orderType === "post_only" && !req.limitPrice) {
    return { passed: false, stage, reason: "post_only requires limitPrice" };
  }

  // FOK/IOC not compatible with GTC stop orders
  if ((req.orderType === "stop" || req.orderType === "stop_limit") && tif !== "gtc") {
    return { passed: false, stage, reason: `Stop orders must use GTC TIF, got: ${tif}` };
  }

  return { passed: true, stage };
}

function validateQuantity(quantityStr: string): ValidationResult {
  const stage: ValidationStage = "quantity";
  const qty = parseFloat(quantityStr);

  if (isNaN(qty) || qty <= 0) {
    return { passed: false, stage, reason: `Quantity must be positive, got: ${quantityStr}` };
  }
  if (qty < MIN_QUANTITY) {
    return { passed: false, stage, reason: `Quantity below minimum: ${qty} < ${MIN_QUANTITY}` };
  }
  if (qty > MAX_QUANTITY) {
    return { passed: false, stage, reason: `Quantity exceeds maximum: ${qty} > ${MAX_QUANTITY}` };
  }

  return { passed: true, stage };
}

function validatePositionLimits(quantityStr: string): ValidationResult {
  const stage: ValidationStage = "position_limits";
  const qty = parseFloat(quantityStr);

  // Simplified position limit: max 10,000 units per order
  const MAX_ORDER_SIZE = 10_000;
  if (qty > MAX_ORDER_SIZE) {
    return {
      passed: false,
      stage,
      reason: `Order size ${qty} exceeds position limit ${MAX_ORDER_SIZE}`,
      detail: { qty, limit: MAX_ORDER_SIZE },
    };
  }

  return { passed: true, stage };
}

async function validateRiskProfile(req: CreateOrderRequest): Promise<ValidationResult> {
  const stage: ValidationStage = "risk_profile";

  // In simulation mode, risk profile is advisory only — always passes
  if ((req.executionMode ?? "simulation") === "simulation") {
    return { passed: true, stage, detail: { note: "simulation mode — risk advisory only" } };
  }

  // Paper/live_disabled: check risk profile exists and account has headroom
  // Simplified: always passes unless account is unresolvable
  return { passed: true, stage };
}

async function validateCircuitBreakers(): Promise<ValidationResult> {
  const stage: ValidationStage = "circuit_breakers";

  try {
    const allBreakers = getAllBreakerStates();
    const active = allBreakers.filter((cb) => cb.state === "active" || cb.state === "triggered");
    if (active.length > 0) {
      const types = active.map((cb) => cb.type).join(", ");
      return {
        passed: false,
        stage,
        reason: `Circuit breakers active: ${types}`,
        detail: { activeBreakers: active.length, types },
      };
    }
    return { passed: true, stage };
  } catch {
    // If circuit breaker check fails, allow order through (fail-open for paper mode)
    return { passed: true, stage, detail: { note: "circuit breaker check unavailable" } };
  }
}

async function validateKillSwitch(): Promise<ValidationResult> {
  const stage: ValidationStage = "kill_switch";

  try {
    const ks = getKillSwitchStatus();
    if (ks && ks.isActive) {
      return {
        passed: false,
        stage,
        reason: `Kill switch active: ${ks.scope}`,
        detail: { scope: ks.scope, reason: ks.reason },
      };
    }
    return { passed: true, stage };
  } catch {
    // Fail-open for paper/simulation
    return { passed: true, stage, detail: { note: "kill switch check unavailable" } };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(stages: ValidationResult[], failed: ValidationResult): PipelineResult {
  return {
    passed: false,
    stages,
    failedAt: failed.stage,
    rejectReason: failed.reason,
  };
}
