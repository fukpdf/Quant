import { logger } from "../lib/logger";
import type { FillResult } from "./execution-types";
import { getPaperExecutionProvider } from "./paper-execution-provider";
import {
  insertExecutionFill,
  updateExecutionOrderStatus,
  getOrderFills,
  insertExecutionAuditLog,
} from "./execution-db";
import { transition } from "./execution-state-machine";
import type { OrderStatus } from "./execution-types";
import { getMarketState } from "./market-state-engine";
import { publish } from "./event-bus";

/**
 * execution-fill-engine.ts — Fill processing for all order types (ADR-029).
 *
 * Handles:
 * - Full fills (single fill event, order complete)
 * - Partial fills (multiple events, cumulative tracking)
 * - Average fill price computation (VWAP across fills)
 * - Slippage computation vs limit price
 * - Commission calculation (provider-specific rates)
 *
 * Called by the OMS after a provider ACK.
 */

const DEFAULT_COMMISSION_RATE = 0.001; // 0.1% taker
const DEFAULT_COMMISSION_ASSET = "USDT";

interface FillOptions {
  orderId: string;
  accountId: string;
  symbol: string;
  side: string;
  orderType: string;
  requestedQuantity: string;
  limitPrice: string | null | undefined;
  currentStatus: OrderStatus;
  executionMode: string;
  marketPrice?: string;
  /** If provided, fills exactly this quantity (partial fill simulation) */
  fillQuantityOverride?: string;
}

/**
 * Process a fill event for an order.
 * Returns the fill result and updates the order in DB.
 */
export async function processFill(opts: FillOptions): Promise<FillResult> {
  const {
    orderId,
    symbol,
    side,
    orderType,
    requestedQuantity,
    limitPrice,
    currentStatus,
    executionMode,
    marketPrice,
  } = opts;

  const startMs = Date.now();

  // Determine fill price
  const fillPrice = computeFillPrice({
    symbol,
    side,
    orderType,
    limitPrice,
    marketPrice,
    executionMode,
  });

  // Get existing fills to compute cumulative
  const existingFills = await getOrderFills(orderId);
  const cumulativeQtyBefore = existingFills.reduce(
    (sum, f) => sum + parseFloat(f.fillQuantity as string),
    0,
  );
  const remaining = parseFloat(requestedQuantity) - cumulativeQtyBefore;

  // Fill quantity: all remaining for a full fill (or override for partial)
  const fillQty = opts.fillQuantityOverride
    ? Math.min(parseFloat(opts.fillQuantityOverride), remaining)
    : remaining;

  if (fillQty <= 0) {
    throw new Error(`No remaining quantity to fill for order ${orderId}`);
  }

  const cumulativeQty = cumulativeQtyBefore + fillQty;
  const remainingQty = parseFloat(requestedQuantity) - cumulativeQty;
  const isComplete = remainingQty <= 0.000001;
  const fillType = isComplete ? "full" : "partial";

  // Commission
  const commission = (parseFloat(fillPrice) * fillQty * DEFAULT_COMMISSION_RATE).toFixed(8);

  // Slippage vs limit price
  let slippageBps = "0";
  if (limitPrice) {
    const limit = parseFloat(limitPrice);
    const fill = parseFloat(fillPrice);
    const slippage = side === "buy"
      ? ((fill - limit) / limit) * 10000
      : ((limit - fill) / limit) * 10000;
    slippageBps = slippage.toFixed(4);
  }

  const fillLatencyMs = Date.now() - startMs;

  // Persist the fill record
  await insertExecutionFill({
    orderId,
    fillPrice,
    fillQuantity: fillQty.toFixed(8),
    commission,
    commissionAsset: DEFAULT_COMMISSION_ASSET,
    isMaker: orderType === "post_only",
    slippageBps,
    cumulativeQty: cumulativeQty.toFixed(8),
    remainingQty: remainingQty < 0 ? "0" : remainingQty.toFixed(8),
    fillType,
    fillLatencyMs: String(fillLatencyMs),
  });

  // Compute average fill price across all fills (including this one)
  const allFillsForAvg = [...existingFills.map((f) => ({
    price: parseFloat(f.fillPrice as string),
    qty: parseFloat(f.fillQuantity as string),
  })), { price: parseFloat(fillPrice), qty: fillQty }];

  const totalQty = allFillsForAvg.reduce((s, f) => s + f.qty, 0);
  const avgFillPrice = (
    allFillsForAvg.reduce((s, f) => s + f.price * f.qty, 0) / totalQty
  ).toFixed(8);

  // Transition order state
  const nextStatus: OrderStatus = isComplete ? "filled" : "partially_filled";

  await transition({
    orderId,
    fromStatus: currentStatus,
    toStatus: nextStatus,
    event: isComplete ? "FillComplete" : "PartialFill",
    actor: "fill_engine",
    detail: {
      fillPrice,
      fillQty: fillQty.toFixed(8),
      cumulativeQty: cumulativeQty.toFixed(8),
      remainingQty: remainingQty.toFixed(8),
      avgFillPrice,
      fillType,
    },
    orderUpdate: {
      filledQuantity: cumulativeQty.toFixed(8),
      remainingQuantity: remainingQty < 0 ? "0" : remainingQty.toFixed(8),
      avgFillPrice,
      commission,
      totalLatencyMs: String(fillLatencyMs),
      ...(isComplete ? { filledAt: new Date() } : {}),
    },
  });

  // Audit log
  await insertExecutionAuditLog({
    orderId,
    action: isComplete ? "order_filled" : "order_partially_filled",
    actor: "fill_engine",
    executionMode,
    symbol,
    detail: { fillPrice, fillQty: fillQty.toFixed(8), fillType, slippageBps },
    success: true,
  });

  // Event bus
  publish({
    eventType: isComplete ? "OrderFilled" : "OrderFilled",
    source: "fill_engine",
    symbol,
    data: {
      orderId,
      fillPrice,
      fillQty: fillQty.toFixed(8),
      fillType,
      avgFillPrice,
      executionMode,
    },
    emittedAt: Date.now(),
  });

  logger.info(
    { orderId, symbol, fillPrice, fillQty: fillQty.toFixed(8), fillType, slippageBps },
    `Fill engine: ${fillType} fill processed`,
  );

  return {
    orderId,
    fillPrice,
    fillQuantity: fillQty.toFixed(8),
    cumulativeQty: cumulativeQty.toFixed(8),
    remainingQty: remainingQty < 0 ? "0" : remainingQty.toFixed(8),
    commission,
    commissionAsset: DEFAULT_COMMISSION_ASSET,
    isMaker: orderType === "post_only",
    slippageBps,
    fillType,
    fillLatencyMs,
  };
}

// ---------------------------------------------------------------------------
// Price computation
// ---------------------------------------------------------------------------

function computeFillPrice(opts: {
  symbol: string;
  side: string;
  orderType: string;
  limitPrice?: string | null;
  marketPrice?: string;
  executionMode: string;
}): string {
  const { symbol, side, orderType, limitPrice, marketPrice, executionMode } = opts;

  // Paper mode: use live market state
  if (executionMode === "paper") {
    const marketState = getMarketState(symbol);
    if (marketState) {
      if (orderType === "market") {
        const base = side === "buy"
          ? parseFloat(marketState.askPrice || String(marketState.lastPrice))
          : parseFloat(marketState.bidPrice || String(marketState.lastPrice));
        const slipFactor = side === "buy" ? 1.0005 : 0.9995;
        return (base * slipFactor).toFixed(8);
      }
      return limitPrice ?? String(marketState.lastPrice);
    }
  }

  // Simulation mode or no market state: use limit price or market price fallback
  if (limitPrice) return limitPrice;
  if (marketPrice) {
    // Apply small slippage for market orders in simulation
    if (orderType === "market") {
      const base = parseFloat(marketPrice);
      const slipFactor = side === "buy" ? 1.0005 : 0.9995;
      return (base * slipFactor).toFixed(8);
    }
    return marketPrice;
  }

  // Final fallback — shouldn't reach here if validation is correct
  return "0";
}
