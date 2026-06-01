import { logger } from "../lib/logger";
import {
  createPaperPosition,
  updatePaperPosition,
  getOpenPositions,
  recordPaperTrade,
  getOpenPositionBySymbolAndStrategy,
  updatePaperAccount,
  getPaperAccount,
} from "./paper-accounts-db";
import type { PaperPosition } from "@workspace/db";

/**
 * Paper Position Manager — Phase 5.
 *
 * Manages the lifecycle of paper positions:
 *   - Open a new long/short position
 *   - Close an existing position
 *   - Mark-to-market unrealized PnL across all open positions
 *
 * All positions are simulated. No real capital changes.
 */

export interface OpenPositionRequest {
  accountId: string;
  strategyName: string;
  symbol: string;
  side: "long" | "short";
  quantity: number;
  fillPrice: number;
  commission: number;
  slippage: number;
}

export interface ClosePositionRequest {
  positionId: string;
  accountId: string;
  exitPrice: number;
  commission: number;
  slippage: number;
  exitSignal?: string;
}

export interface MarkToMarketRequest {
  accountId: string;
  /** Map of symbol → current market price */
  prices: Record<string, number>;
}

/**
 * Open a new paper position.
 * Deducts the cost from the account cash balance.
 * Returns the newly created position record.
 */
export async function openPaperPosition(req: OpenPositionRequest): Promise<PaperPosition> {
  const account = await getPaperAccount(req.accountId);
  if (!account) throw new Error(`Account not found: ${req.accountId}`);

  const notional = req.fillPrice * req.quantity;
  const totalCost = notional + req.commission + req.slippage;
  const currentCash = parseFloat(account.cashBalance);

  if (currentCash < totalCost) {
    throw new Error(
      `Insufficient cash balance: have ${currentCash.toFixed(2)}, need ${totalCost.toFixed(2)}`,
    );
  }

  const position = await createPaperPosition({
    accountId: req.accountId,
    strategyName: req.strategyName,
    symbol: req.symbol,
    side: req.side,
    status: "open",
    quantity: String(req.quantity),
    entryPrice: String(req.fillPrice),
    currentPrice: String(req.fillPrice),
    marketValue: String(notional),
    unrealizedPnl: "0",
    commission: String(req.commission),
    slippage: String(req.slippage),
  });

  // Deduct cost from cash
  const newCash = currentCash - totalCost;
  await updatePaperAccount(req.accountId, {
    cashBalance: String(newCash),
    buyingPower: String(newCash),
  });

  logger.info(
    {
      accountId: req.accountId,
      positionId: position.id,
      symbol: req.symbol,
      side: req.side,
      quantity: req.quantity,
      fillPrice: req.fillPrice,
      totalCost,
    },
    "Paper position opened",
  );

  return position;
}

/**
 * Close an existing paper position.
 * Returns cash to the account and records completed trade in history.
 */
export async function closePaperPosition(req: ClosePositionRequest): Promise<void> {
  const account = await getPaperAccount(req.accountId);
  if (!account) throw new Error(`Account not found: ${req.accountId}`);

  const openPositions = await getOpenPositions(req.accountId);
  const position = openPositions.find((p) => p.id === req.positionId);
  if (!position) throw new Error(`Open position not found: ${req.positionId}`);

  const qty = parseFloat(position.quantity);
  const entryPrice = parseFloat(position.entryPrice);
  const entryCommission = parseFloat(position.commission);
  const entrySlippage = parseFloat(position.slippage);

  // Gross PnL (price difference × quantity)
  const grossPnl =
    position.side === "long"
      ? (req.exitPrice - entryPrice) * qty
      : (entryPrice - req.exitPrice) * qty;

  // Net PnL after all costs
  const netPnl = grossPnl - req.commission - req.slippage;
  const returnPct = entryPrice > 0 ? grossPnl / (entryPrice * qty) : 0;

  // Update position to closed
  await updatePaperPosition(req.positionId, {
    status: "closed",
    exitPrice: String(req.exitPrice),
    realizedPnl: String(netPnl),
    closedAt: new Date(),
  });

  // Return proceeds to cash
  const proceeds = req.exitPrice * qty - req.commission - req.slippage;
  const currentCash = parseFloat(account.cashBalance);
  const newCash = currentCash + proceeds;
  const currentRealizedPnl = parseFloat(account.realizedPnl);

  await updatePaperAccount(req.accountId, {
    cashBalance: String(newCash),
    buyingPower: String(newCash),
    realizedPnl: String(currentRealizedPnl + netPnl),
  });

  // Record in trade history
  const enteredAt = position.openedAt instanceof Date ? position.openedAt : new Date(position.openedAt);
  const exitedAt = new Date();
  const holdingMinutes = (exitedAt.getTime() - enteredAt.getTime()) / (1000 * 60);

  await recordPaperTrade({
    accountId: req.accountId,
    strategyName: position.strategyName ?? undefined,
    symbol: position.symbol,
    side: position.side,
    quantity: position.quantity,
    entryPrice: position.entryPrice,
    exitPrice: String(req.exitPrice),
    grossPnl: String(grossPnl),
    netPnl: String(netPnl),
    returnPct: String(returnPct),
    commission: String(entryCommission + req.commission),
    slippage: String(entrySlippage + req.slippage),
    holdingMinutes: String(holdingMinutes),
    entrySignal: "BUY_SIGNAL",
    exitSignal: req.exitSignal ?? "SELL_SIGNAL",
    enteredAt,
    exitedAt,
  });

  logger.info(
    {
      accountId: req.accountId,
      positionId: req.positionId,
      symbol: position.symbol,
      grossPnl,
      netPnl,
      returnPct,
    },
    "Paper position closed",
  );
}

/**
 * Mark all open positions to market — updates unrealized PnL using current prices.
 * Also updates the account's unrealizedPnl and currentEquity fields.
 */
export async function markToMarket(req: MarkToMarketRequest): Promise<void> {
  const account = await getPaperAccount(req.accountId);
  if (!account) return;

  const openPositions = await getOpenPositions(req.accountId);
  if (openPositions.length === 0) {
    await updatePaperAccount(req.accountId, {
      unrealizedPnl: "0",
      currentEquity: account.cashBalance,
    });
    return;
  }

  let totalUnrealized = 0;
  let totalMarketValue = 0;

  for (const pos of openPositions) {
    const currentPrice = req.prices[pos.symbol];
    if (currentPrice === undefined) continue;

    const qty = parseFloat(pos.quantity);
    const entryPrice = parseFloat(pos.entryPrice);
    const marketValue = currentPrice * qty;
    const unrealizedPnl =
      pos.side === "long"
        ? (currentPrice - entryPrice) * qty
        : (entryPrice - currentPrice) * qty;

    totalUnrealized += unrealizedPnl;
    totalMarketValue += marketValue;

    await updatePaperPosition(pos.id, {
      currentPrice: String(currentPrice),
      marketValue: String(marketValue),
      unrealizedPnl: String(unrealizedPnl),
    });
  }

  const cashBalance = parseFloat(account.cashBalance);
  const currentEquity = cashBalance + totalMarketValue;

  await updatePaperAccount(req.accountId, {
    unrealizedPnl: String(totalUnrealized),
    currentEquity: String(currentEquity),
  });
}

/**
 * Look up the open position for a specific strategy+symbol on an account.
 * Used by the signal engine to determine if a position already exists.
 */
export async function findOpenPosition(
  accountId: string,
  symbol: string,
  strategyName: string,
): Promise<PaperPosition | null> {
  return getOpenPositionBySymbolAndStrategy(accountId, symbol, strategyName);
}
