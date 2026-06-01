import { applySlippage, calculateCommission, EXCHANGE_PROFILES } from "./cost-model";
import type { CostModelConfig } from "./cost-model";
import { logger } from "../lib/logger";

/**
 * Paper Execution Engine — Phase 5.
 *
 * Simulates realistic order fills against a provided market price.
 * No real broker. No real capital. Simulation only.
 *
 * Applies:
 * - Slippage (using Phase 4 cost model)
 * - Commission (using Phase 4 cost model)
 * - Latency simulation (random within configurable bounds)
 * - Partial fill logic for large orders
 */

export interface ExecutionRequest {
  side: "buy" | "sell";
  symbol: string;
  quantity: number;
  orderType: "market" | "limit" | "stop" | "stop_limit";
  /** The current market price at execution time */
  marketPrice: number;
  /** Limit price — required for limit / stop_limit orders */
  limitPrice?: number;
  /** Stop trigger price — required for stop / stop_limit orders */
  stopPrice?: number;
  /** Recent candle volume for volume-based slippage */
  recentVolume?: number;
  /** Recent price std-dev for volatility-based slippage */
  recentVolatility?: number;
  /** Cost model to apply (defaults to Binance spot) */
  costModel?: CostModelConfig;
}

export interface ExecutionResult {
  success: boolean;
  failureReason?: string;
  /** Price after slippage */
  executedPrice: number;
  /** Raw price before slippage */
  rawPrice: number;
  /** Quantity actually filled (may be less than requested for partial fills) */
  filledQuantity: number;
  /** Commission charged */
  commission: number;
  /** Slippage impact in quote units */
  slippage: number;
  /** Simulated processing latency in ms */
  latencyMs: number;
}

/** Default cost model for paper trading — Binance Spot (realistic but not zero-cost) */
const DEFAULT_PAPER_COST_MODEL: CostModelConfig = EXCHANGE_PROFILES["binance_spot"]!;

/** Simulate processing latency between MIN and MAX ms */
const MIN_LATENCY_MS = 5;
const MAX_LATENCY_MS = 50;

function simulateLatency(): number {
  return MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
}

/**
 * Determines whether a limit or stop order would fill at the current market price.
 * Market orders always fill immediately.
 */
function wouldFill(request: ExecutionRequest): { fill: boolean; reason?: string } {
  const { orderType, side, marketPrice, limitPrice, stopPrice } = request;

  if (orderType === "market") return { fill: true };

  if (orderType === "limit") {
    if (!limitPrice) return { fill: false, reason: "limit_price_required" };
    // BUY limit fills when market drops to or below limit
    if (side === "buy" && marketPrice <= limitPrice) return { fill: true };
    // SELL limit fills when market rises to or above limit
    if (side === "sell" && marketPrice >= limitPrice) return { fill: true };
    return { fill: false, reason: "limit_not_reached" };
  }

  if (orderType === "stop") {
    if (!stopPrice) return { fill: false, reason: "stop_price_required" };
    // BUY stop fills when market rises to or above stop (breakout buy)
    if (side === "buy" && marketPrice >= stopPrice) return { fill: true };
    // SELL stop fills when market drops to or below stop (stop-loss)
    if (side === "sell" && marketPrice <= stopPrice) return { fill: true };
    return { fill: false, reason: "stop_not_triggered" };
  }

  if (orderType === "stop_limit") {
    if (!stopPrice || !limitPrice) return { fill: false, reason: "stop_and_limit_price_required" };
    // Stop must trigger first, then limit logic applies
    const stopTriggered =
      (side === "buy" && marketPrice >= stopPrice) ||
      (side === "sell" && marketPrice <= stopPrice);
    if (!stopTriggered) return { fill: false, reason: "stop_not_triggered" };
    // Once triggered, treat as limit order
    if (side === "buy" && marketPrice <= limitPrice) return { fill: true };
    if (side === "sell" && marketPrice >= limitPrice) return { fill: true };
    return { fill: false, reason: "limit_not_reached_after_stop" };
  }

  return { fill: false, reason: "unknown_order_type" };
}

/**
 * Simulate partial fill: large orders may not fully fill in one shot.
 * For simplicity: orders > 5% of recent volume get a 70–100% partial fill.
 */
function computeFilledQuantity(
  requestedQty: number,
  marketPrice: number,
  recentVolume?: number,
): number {
  if (!recentVolume || recentVolume <= 0) return requestedQty;

  const notional = requestedQty * marketPrice;
  const volumeValue = recentVolume * marketPrice;
  const participationRate = notional / volumeValue;

  // If the order is larger than 5% of candle volume, simulate partial fill
  if (participationRate > 0.05) {
    const fillFraction = 0.7 + Math.random() * 0.3; // 70–100%
    return requestedQty * fillFraction;
  }

  return requestedQty;
}

/**
 * Execute a simulated order against the current market price.
 * Returns the fill result including price, quantity, costs, and latency.
 */
export function executeOrder(request: ExecutionRequest): ExecutionResult {
  const costModel = request.costModel ?? DEFAULT_PAPER_COST_MODEL;
  const latencyMs = simulateLatency();

  // Check whether the order would fill at this price
  const fillCheck = wouldFill(request);
  if (!fillCheck.fill) {
    return {
      success: false,
      failureReason: fillCheck.reason ?? "order_not_fillable",
      executedPrice: 0,
      rawPrice: request.marketPrice,
      filledQuantity: 0,
      commission: 0,
      slippage: 0,
      latencyMs,
    };
  }

  // Determine raw fill price (limit orders fill at limit if better, otherwise market)
  let rawPrice = request.marketPrice;
  if (
    (request.orderType === "limit" || request.orderType === "stop_limit") &&
    request.limitPrice !== undefined
  ) {
    if (request.side === "buy") rawPrice = Math.min(request.marketPrice, request.limitPrice);
    if (request.side === "sell") rawPrice = Math.max(request.marketPrice, request.limitPrice);
  }

  // Apply slippage
  const sideForSlippage = request.side === "buy" ? "BUY" : "SELL";
  const { adjustedPrice, slippageAmount } = applySlippage(
    rawPrice,
    sideForSlippage,
    costModel,
    request.recentVolatility ?? 0,
    rawPrice * request.quantity,
    request.recentVolume ?? 1,
  );

  // Compute filled quantity (partial fill logic)
  const filledQuantity = computeFilledQuantity(
    request.quantity,
    rawPrice,
    request.recentVolume,
  );

  // Compute commission
  const notionalValue = adjustedPrice * filledQuantity;
  const commission = calculateCommission(notionalValue, costModel, false);
  const slippage = slippageAmount * filledQuantity;

  logger.debug(
    {
      symbol: request.symbol,
      side: request.side,
      orderType: request.orderType,
      rawPrice,
      executedPrice: adjustedPrice,
      filledQuantity,
      commission,
      slippage,
      latencyMs,
    },
    "Paper order executed",
  );

  return {
    success: true,
    executedPrice: adjustedPrice,
    rawPrice,
    filledQuantity,
    commission,
    slippage,
    latencyMs,
  };
}
