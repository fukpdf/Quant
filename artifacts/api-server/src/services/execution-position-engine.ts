import { logger } from "../lib/logger";
import type { PositionUpdate } from "./execution-types";
import {
  insertExecutionPosition,
  getOpenPositionForSymbol,
  updateExecutionPosition,
  insertExecutionAuditLog,
} from "./execution-db";
import { publish } from "./event-bus";
import { getMarketState } from "./market-state-engine";

/**
 * execution-position-engine.ts — Position lifecycle management (ADR-030).
 *
 * Tracks open and closed positions derived from execution fills.
 *
 * Position lifecycle:
 * - BUY fill on symbol with no open position → open new LONG position
 * - SELL fill on symbol with no open position → open new SHORT position
 * - Fill in opposite direction to open position → reduce / close position
 * - Partial reduction → update quantity and realized PnL
 * - Full close → mark position closed, compute final realized PnL
 *
 * Realized PnL formula (long):
 *   realized_pnl += (exit_price - avg_entry) * quantity_closed
 *
 * Realized PnL formula (short):
 *   realized_pnl += (avg_entry - exit_price) * quantity_closed
 */

interface FillContext {
  orderId: string;
  accountId: string;
  symbol: string;
  side: "buy" | "sell";
  fillPrice: string;
  fillQuantity: string;
  commission: string;
  executionMode: string;
  strategyName?: string;
}

export async function onFill(ctx: FillContext): Promise<PositionUpdate | null> {
  const {
    orderId,
    accountId,
    symbol,
    side,
    fillPrice,
    fillQuantity,
    commission,
    executionMode,
    strategyName,
  } = ctx;

  const fillPriceF = parseFloat(fillPrice);
  const fillQtyF = parseFloat(fillQuantity);
  const commissionF = parseFloat(commission);

  // Determine position direction: buy opens/adds long, sell opens/adds short
  const newSide: "long" | "short" = side === "buy" ? "long" : "short";
  const oppositeSide: "long" | "short" = side === "buy" ? "short" : "long";

  // Check for existing open position
  let existingPosition = await getOpenPositionForSymbol(accountId, symbol);

  if (!existingPosition) {
    // No open position — open a new one
    const notional = (fillPriceF * fillQtyF).toFixed(8);
    const position = await insertExecutionPosition({
      accountId,
      symbol,
      side: newSide,
      quantity: fillQtyF.toFixed(8),
      avgEntryPrice: fillPrice,
      currentPrice: fillPrice,
      unrealizedPnl: "0",
      realizedPnl: "0",
      totalCommission: commission,
      notionalValue: notional,
      status: "open",
      openOrderId: orderId,
      strategyName: strategyName ?? null,
      executionMode,
    });

    const update: PositionUpdate = {
      positionId: position.id,
      symbol,
      side: newSide,
      quantity: fillQtyF.toFixed(8),
      avgEntryPrice: fillPrice,
      currentPrice: fillPrice,
      unrealizedPnl: "0",
      realizedPnl: "0",
      status: "open",
    };

    await emitPositionEvent(update, orderId, executionMode, symbol);
    await auditPosition(update.positionId, "position_opened", orderId, symbol, executionMode, fillPrice, fillQtyF.toFixed(8));

    logger.info({ positionId: position.id, symbol, side: newSide, qty: fillQtyF }, "Position opened");
    return update;
  }

  if (existingPosition.side === newSide) {
    // Adding to existing position — update average entry price (VWAP)
    const existingQty = parseFloat(existingPosition.quantity as string);
    const existingAvg = parseFloat(existingPosition.avgEntryPrice as string);
    const existingCommission = parseFloat(existingPosition.totalCommission as string);

    const newTotalQty = existingQty + fillQtyF;
    const newAvgEntry = ((existingAvg * existingQty) + (fillPriceF * fillQtyF)) / newTotalQty;
    const newCommission = existingCommission + commissionF;
    const newNotional = (newAvgEntry * newTotalQty).toFixed(8);

    // Unrealized PnL at current market price
    const markPrice = getCurrentPrice(symbol, fillPrice);
    const unrealizedPnl = computeUnrealizedPnl(newSide, newAvgEntry, parseFloat(markPrice), newTotalQty);

    await updateExecutionPosition(existingPosition.id, {
      quantity: newTotalQty.toFixed(8),
      avgEntryPrice: newAvgEntry.toFixed(8),
      currentPrice: markPrice,
      unrealizedPnl: unrealizedPnl.toFixed(8),
      totalCommission: newCommission.toFixed(8),
      notionalValue: newNotional,
    });

    const update: PositionUpdate = {
      positionId: existingPosition.id,
      symbol,
      side: newSide,
      quantity: newTotalQty.toFixed(8),
      avgEntryPrice: newAvgEntry.toFixed(8),
      currentPrice: markPrice,
      unrealizedPnl: unrealizedPnl.toFixed(8),
      realizedPnl: existingPosition.realizedPnl as string ?? "0",
      status: "open",
    };

    await emitPositionEvent(update, orderId, executionMode, symbol);
    logger.info({ positionId: existingPosition.id, symbol, newQty: newTotalQty }, "Position size increased");
    return update;
  }

  // Closing / reducing existing position (opposite side)
  const existingQty = parseFloat(existingPosition.quantity as string);
  const existingAvg = parseFloat(existingPosition.avgEntryPrice as string);
  const existingRealizedPnl = parseFloat(existingPosition.realizedPnl as string ?? "0");
  const existingCommission = parseFloat(existingPosition.totalCommission as string ?? "0");

  const closeQty = Math.min(fillQtyF, existingQty);
  const realizedPnlThisFill = computeRealizedPnl(existingPosition.side as "long" | "short", existingAvg, fillPriceF, closeQty);
  const newRealizedPnl = existingRealizedPnl + realizedPnlThisFill;
  const newQty = existingQty - closeQty;
  const newCommission = existingCommission + commissionF;

  if (newQty <= 0.000001) {
    // Full close
    await updateExecutionPosition(existingPosition.id, {
      quantity: "0",
      realizedPnl: newRealizedPnl.toFixed(8),
      unrealizedPnl: "0",
      totalCommission: newCommission.toFixed(8),
      status: "closed",
      closeOrderId: orderId,
      closedAt: new Date(),
    });

    const update: PositionUpdate = {
      positionId: existingPosition.id,
      symbol,
      side: existingPosition.side as "long" | "short",
      quantity: "0",
      avgEntryPrice: existingPosition.avgEntryPrice as string,
      currentPrice: fillPrice,
      unrealizedPnl: "0",
      realizedPnl: newRealizedPnl.toFixed(8),
      status: "closed",
    };

    await emitPositionEvent(update, orderId, executionMode, symbol);
    await auditPosition(update.positionId, "position_closed", orderId, symbol, executionMode, fillPrice, closeQty.toFixed(8));

    logger.info({ positionId: existingPosition.id, symbol, realizedPnl: newRealizedPnl }, "Position closed");
    return update;
  }

  // Partial close
  const markPrice = getCurrentPrice(symbol, fillPrice);
  const unrealizedPnl = computeUnrealizedPnl(existingPosition.side as "long" | "short", existingAvg, parseFloat(markPrice), newQty);

  await updateExecutionPosition(existingPosition.id, {
    quantity: newQty.toFixed(8),
    realizedPnl: newRealizedPnl.toFixed(8),
    currentPrice: markPrice,
    unrealizedPnl: unrealizedPnl.toFixed(8),
    totalCommission: newCommission.toFixed(8),
  });

  const update: PositionUpdate = {
    positionId: existingPosition.id,
    symbol,
    side: existingPosition.side as "long" | "short",
    quantity: newQty.toFixed(8),
    avgEntryPrice: existingPosition.avgEntryPrice as string,
    currentPrice: markPrice,
    unrealizedPnl: unrealizedPnl.toFixed(8),
    realizedPnl: newRealizedPnl.toFixed(8),
    status: "open",
  };

  await emitPositionEvent(update, orderId, executionMode, symbol);
  logger.info({ positionId: existingPosition.id, symbol, newQty, realizedPnl: realizedPnlThisFill }, "Position partially closed");
  return update;
}

/**
 * Mark-to-market: update unrealized PnL for all open positions of a symbol.
 * Called periodically by the execution monitor.
 */
export async function markToMarket(accountId: string, symbol: string): Promise<void> {
  const position = await getOpenPositionForSymbol(accountId, symbol);
  if (!position) return;

  const markPrice = getCurrentPrice(symbol, position.avgEntryPrice as string);
  const markF = parseFloat(markPrice);
  const avgEntry = parseFloat(position.avgEntryPrice as string);
  const qty = parseFloat(position.quantity as string);

  const unrealizedPnl = computeUnrealizedPnl(position.side as "long" | "short", avgEntry, markF, qty);

  await updateExecutionPosition(position.id, {
    currentPrice: markPrice,
    unrealizedPnl: unrealizedPnl.toFixed(8),
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeRealizedPnl(side: "long" | "short", avgEntry: number, exitPrice: number, qty: number): number {
  return side === "long"
    ? (exitPrice - avgEntry) * qty
    : (avgEntry - exitPrice) * qty;
}

function computeUnrealizedPnl(side: "long" | "short", avgEntry: number, currentPrice: number, qty: number): number {
  return side === "long"
    ? (currentPrice - avgEntry) * qty
    : (avgEntry - currentPrice) * qty;
}

function getCurrentPrice(symbol: string, fallback: string): string {
  const ms = getMarketState(symbol);
  if (ms) return String(ms.lastPrice);
  return fallback;
}

async function emitPositionEvent(update: PositionUpdate, orderId: string, executionMode: string, symbol: string) {
  publish({
    eventType: "PositionUpdated",
    source: "position_engine",
    symbol,
    data: { ...update, orderId, executionMode },
    emittedAt: Date.now(),
  });
}

async function auditPosition(
  positionId: string,
  action: "position_opened" | "position_closed",
  orderId: string,
  symbol: string,
  executionMode: string,
  price: string,
  qty: string,
) {
  await insertExecutionAuditLog({
    orderId,
    action,
    actor: "position_engine",
    executionMode,
    symbol,
    detail: { positionId, price, qty },
    success: true,
  });
}
