import { logger } from "../lib/logger";
import {
  createRiskDecision,
  createRiskViolation,
  createRiskEvent,
  appendAuditLog,
} from "./risk-db";
import { resolveActiveProfile } from "./risk-profile-service";
import { isAccountHalted, isStrategyHalted, isTradingHalted } from "./kill-switch-service";
import { isCircuitBreakerTriggered } from "./circuit-breaker-service";
import { getPaperAccount } from "./paper-accounts-db";
import { getLatestStrategyRiskScore } from "./risk-db";
import type { RiskProfile } from "@workspace/db";

/**
 * Risk Engine — Phase 6. Central pre-trade capital protection authority.
 *
 * Every order MUST be submitted through evaluateOrder() before execution.
 * An order that is rejected MUST NOT reach the execution engine.
 *
 * Checks performed (in priority order):
 *  1. Kill switch (global trading halt)
 *  2. Account-level kill switch
 *  3. Strategy-level kill switch
 *  4. Circuit breaker (any triggered for this account)
 *  5. Account status (must be active)
 *  6. Position size limit (notional vs equity)
 *  7. Portfolio exposure limit (total exposure vs equity)
 *  8. Daily loss limit (realized P&L vs limit)
 *  9. Account drawdown limit (current drawdown vs max)
 * 10. Concentration limit (single position as % of portfolio)
 * 11. Max open positions limit
 * 12. Strategy confidence score (vs minimum required)
 * 13. Data freshness check (latest candle age)
 *
 * Decision: "approved" | "rejected" | "requires_review"
 */

export interface OrderCheckInput {
  accountId: string;
  strategyName?: string;
  strategyAssignmentId?: string;
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  /** Estimated order notional = quantity × marketPrice */
  notional: number;
  /** Latest candle age in minutes — for data freshness check */
  dataAgeMinutes?: number;
  /** Current open positions count for this account */
  openPositionsCount?: number;
  /** Current total portfolio exposure in USD */
  currentExposure?: number;
}

export interface RiskCheckResult {
  decision: "approved" | "rejected" | "requires_review";
  riskScore: number;
  reason: string;
  triggeredRules: string[];
}

/**
 * Evaluate a proposed paper order against all active risk controls.
 * Stores the decision in risk_decisions and violations in risk_violations.
 * Returns the decision for the caller to act on.
 */
export async function evaluateOrder(input: OrderCheckInput): Promise<RiskCheckResult> {
  const {
    accountId,
    strategyName,
    strategyAssignmentId,
    symbol,
    side,
    quantity,
    notional,
    dataAgeMinutes = 0,
    openPositionsCount = 0,
    currentExposure = 0,
  } = input;

  const triggeredRules: string[] = [];
  let riskScore = 0;

  // ------------------------------------------------------------------
  // Helper: reject immediately and persist decision
  // ------------------------------------------------------------------
  const reject = async (reason: string): Promise<RiskCheckResult> => {
    const result: RiskCheckResult = {
      decision: "rejected",
      riskScore: Math.min(100, riskScore + 30),
      reason,
      triggeredRules,
    };

    await persistDecision(input, result);
    await persistViolation(input, reason, triggeredRules);
    logger.warn(
      { accountId, symbol, side, quantity, reason },
      "Risk engine: order REJECTED",
    );
    return result;
  };

  // ------------------------------------------------------------------
  // 1. Global trading kill switch
  // ------------------------------------------------------------------
  if (isTradingHalted()) {
    triggeredRules.push("kill_switch.trading");
    riskScore += 100;
    return reject("Global trading halt is active. All orders blocked.");
  }

  // ------------------------------------------------------------------
  // 2. Account-level kill switch
  // ------------------------------------------------------------------
  if (isAccountHalted(accountId)) {
    triggeredRules.push("kill_switch.account");
    riskScore += 100;
    return reject(`Account ${accountId} has an active kill switch.`);
  }

  // ------------------------------------------------------------------
  // 3. Strategy-level kill switch
  // ------------------------------------------------------------------
  if (strategyName && isStrategyHalted(strategyName)) {
    triggeredRules.push("kill_switch.strategy");
    riskScore += 100;
    return reject(`Strategy "${strategyName}" has an active kill switch.`);
  }

  // ------------------------------------------------------------------
  // 4. Circuit breaker
  // ------------------------------------------------------------------
  if (isCircuitBreakerTriggered(accountId)) {
    triggeredRules.push("circuit_breaker.triggered");
    riskScore += 90;
    return reject(`A circuit breaker is active for account ${accountId}.`);
  }

  // ------------------------------------------------------------------
  // 5. Fetch account and profile
  // ------------------------------------------------------------------
  const account = await getPaperAccount(accountId);
  if (!account) {
    triggeredRules.push("account.not_found");
    riskScore += 100;
    return reject(`Account not found: ${accountId}`);
  }

  if (account.status !== "active") {
    triggeredRules.push("account.not_active");
    riskScore += 100;
    return reject(`Account is not active (status: ${account.status}).`);
  }

  const profile = await resolveActiveProfile(accountId);
  if (!profile) {
    // No risk profile — fall through with permissive check (paper trading only)
    logger.warn({ accountId }, "No active risk profile found — using permissive defaults");
  }

  const equity = parseFloat(account.currentEquity);
  if (equity <= 0) {
    triggeredRules.push("account.zero_equity");
    riskScore += 80;
    return reject("Account equity is zero or negative.");
  }

  // ------------------------------------------------------------------
  // 6. Position size limit
  // ------------------------------------------------------------------
  if (profile) {
    const maxPositionSizePct = parseFloat(profile.maxPositionSizePct);
    const positionSizePct = (notional / equity) * 100;

    if (positionSizePct > maxPositionSizePct) {
      triggeredRules.push("position_size_limit");
      riskScore += 40;
      const msg = `Position size ${positionSizePct.toFixed(2)}% exceeds limit ${maxPositionSizePct}% of equity.`;
      return reject(msg);
    }

    riskScore += Math.max(0, (positionSizePct / maxPositionSizePct) * 20);
  }

  // ------------------------------------------------------------------
  // 7. Portfolio exposure limit
  // ------------------------------------------------------------------
  if (profile) {
    const maxExposurePct = parseFloat(profile.maxPortfolioExposurePct);
    const projectedExposure = currentExposure + notional;
    const projectedExposurePct = (projectedExposure / equity) * 100;

    if (projectedExposurePct > maxExposurePct) {
      triggeredRules.push("portfolio_exposure_limit");
      riskScore += 35;
      const msg = `Projected portfolio exposure ${projectedExposurePct.toFixed(2)}% exceeds limit ${maxExposurePct}%.`;
      return reject(msg);
    }

    riskScore += Math.max(0, (projectedExposurePct / maxExposurePct) * 15);
  }

  // ------------------------------------------------------------------
  // 8. Daily loss limit
  // ------------------------------------------------------------------
  if (profile) {
    const maxDailyLossPct = parseFloat(profile.maxDailyLossPct);
    const realizedPnl = parseFloat(account.realizedPnl);
    const unrealizedPnl = parseFloat(account.unrealizedPnl);
    const totalPnlToday = realizedPnl + unrealizedPnl;
    const dailyLossPct = totalPnlToday < 0 ? (Math.abs(totalPnlToday) / equity) * 100 : 0;

    if (dailyLossPct > maxDailyLossPct) {
      triggeredRules.push("daily_loss_limit");
      riskScore += 50;
      const msg = `Daily loss ${dailyLossPct.toFixed(2)}% exceeds limit ${maxDailyLossPct}%.`;
      return reject(msg);
    }

    if (dailyLossPct > maxDailyLossPct * 0.75) {
      triggeredRules.push("daily_loss_warning");
      riskScore += 15;
    }
  }

  // ------------------------------------------------------------------
  // 9. Account drawdown limit
  // ------------------------------------------------------------------
  if (profile) {
    const maxDrawdownPct = parseFloat(profile.maxDrawdownPct);
    const initialCapital = parseFloat(account.initialCapital);
    const peakEquity = Math.max(equity, initialCapital);
    const currentDrawdownPct = peakEquity > 0
      ? ((peakEquity - equity) / peakEquity) * 100
      : 0;

    if (currentDrawdownPct > maxDrawdownPct) {
      triggeredRules.push("drawdown_limit");
      riskScore += 60;
      const msg = `Account drawdown ${currentDrawdownPct.toFixed(2)}% exceeds limit ${maxDrawdownPct}%.`;
      return reject(msg);
    }

    if (currentDrawdownPct > maxDrawdownPct * 0.8) {
      triggeredRules.push("drawdown_warning");
      riskScore += 20;
    }
  }

  // ------------------------------------------------------------------
  // 10. Concentration limit
  // ------------------------------------------------------------------
  if (profile) {
    const concentrationLimitPct = parseFloat(profile.concentrationLimitPct);
    const positionPctOfPortfolio = currentExposure > 0
      ? (notional / (currentExposure + equity)) * 100
      : (notional / equity) * 100;

    if (positionPctOfPortfolio > concentrationLimitPct) {
      triggeredRules.push("concentration_limit");
      riskScore += 25;
      const msg = `Position concentration ${positionPctOfPortfolio.toFixed(2)}% exceeds limit ${concentrationLimitPct}%.`;
      return reject(msg);
    }
  }

  // ------------------------------------------------------------------
  // 11. Max open positions
  // ------------------------------------------------------------------
  if (profile && side === "buy") {
    const maxOpenPositions = profile.maxOpenPositions;
    if (openPositionsCount >= maxOpenPositions) {
      triggeredRules.push("max_open_positions");
      riskScore += 30;
      const msg = `Max open positions (${maxOpenPositions}) reached. Cannot open new position.`;
      return reject(msg);
    }
  }

  // ------------------------------------------------------------------
  // 12. Strategy confidence score
  // ------------------------------------------------------------------
  if (profile && strategyName) {
    const minConfidence = parseFloat(profile.minStrategyConfidenceScore);
    if (minConfidence > 0) {
      const riskScore_ = await getLatestStrategyRiskScore(strategyName);
      if (riskScore_) {
        const confidence = parseFloat(riskScore_.confidenceScore);
        if (confidence < minConfidence) {
          triggeredRules.push("strategy_confidence_score");
          riskScore += 30;
          const msg = `Strategy confidence score ${confidence.toFixed(0)} below minimum required ${minConfidence}.`;
          return reject(msg);
        }
      }
    }
  }

  // ------------------------------------------------------------------
  // 13. Data freshness
  // ------------------------------------------------------------------
  const DATA_FRESHNESS_LIMIT_MINUTES = 30;
  if (dataAgeMinutes > DATA_FRESHNESS_LIMIT_MINUTES) {
    triggeredRules.push("data_freshness");
    riskScore += 20;
    const msg = `Market data for ${symbol} is ${dataAgeMinutes.toFixed(1)} minutes old (limit: ${DATA_FRESHNESS_LIMIT_MINUTES} min).`;
    return reject(msg);
  }

  // ------------------------------------------------------------------
  // All checks passed — determine final decision
  // ------------------------------------------------------------------
  const finalScore = Math.min(100, riskScore);
  const decision: "approved" | "requires_review" =
    finalScore >= 40 ? "requires_review" : "approved";

  const result: RiskCheckResult = {
    decision,
    riskScore: finalScore,
    reason:
      decision === "approved"
        ? "All risk checks passed."
        : `Order flagged for review. Risk score: ${finalScore}. Rules: ${triggeredRules.join(", ")}`,
    triggeredRules,
  };

  await persistDecision(input, result);

  if (decision === "approved") {
    logger.debug({ accountId, symbol, side, quantity, riskScore: finalScore }, "Risk engine: order APPROVED");
  } else {
    logger.info(
      { accountId, symbol, side, quantity, riskScore: finalScore, triggeredRules },
      "Risk engine: order REQUIRES_REVIEW (approved with warnings)",
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

async function persistDecision(
  input: OrderCheckInput,
  result: RiskCheckResult,
): Promise<void> {
  try {
    const profile = await resolveActiveProfile(input.accountId);
    await createRiskDecision({
      accountId: input.accountId,
      strategyAssignmentId: input.strategyAssignmentId ?? null,
      strategyName: input.strategyName ?? null,
      symbol: input.symbol,
      side: input.side,
      quantity: String(input.quantity),
      notional: String(input.notional),
      decision: result.decision,
      riskScore: String(result.riskScore.toFixed(2)),
      reason: result.reason,
      triggeredRules: result.triggeredRules,
      profileId: profile?.id ?? null,
      profileName: profile?.name ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist risk decision");
  }
}

async function persistViolation(
  input: OrderCheckInput,
  reason: string,
  triggeredRules: string[],
): Promise<void> {
  try {
    const primaryRule = triggeredRules[0] ?? "unknown";
    await createRiskViolation({
      ruleId: null,
      ruleType: primaryRule,
      accountId: input.accountId,
      strategyName: input.strategyName ?? null,
      description: reason,
      severity: "warning",
      payload: {
        symbol: input.symbol,
        side: input.side,
        quantity: input.quantity,
        notional: input.notional,
        triggeredRules,
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to persist risk violation");
  }
}
