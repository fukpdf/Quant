import { logger } from "../lib/logger";
import {
  getPaperAccount,
  getPaperPortfolio,
  upsertPaperPortfolio,
  getOpenPositions,
  getAllPositions,
} from "./paper-accounts-db";

/**
 * Paper Portfolio Tracker — Phase 5.
 *
 * Computes and persists aggregate portfolio metrics for a paper account:
 *   - Open / closed position counts
 *   - Total exposure and allocation percentage
 *   - Peak equity and current / max drawdown
 *   - Daily return (compared to yesterday's close)
 *
 * Called after each mark-to-market cycle and after any position open/close.
 */

export interface PortfolioSummary {
  accountId: string;
  openPositions: number;
  closedPositions: number;
  totalExposure: number;
  allocationPct: number;
  currentEquity: number;
  cashBalance: number;
  realizedPnl: number;
  unrealizedPnl: number;
  peakEquity: number;
  currentDrawdownPct: number;
  maxDrawdownPct: number;
  dailyReturnPct: number;
}

/**
 * Refresh portfolio metrics for a given account.
 * Called after any state-changing event (fill, MTM cycle, snapshot).
 */
export async function refreshPortfolio(accountId: string): Promise<PortfolioSummary | null> {
  const account = await getPaperAccount(accountId);
  if (!account) {
    logger.warn({ accountId }, "Portfolio refresh: account not found");
    return null;
  }

  const existingPortfolio = await getPaperPortfolio(accountId);
  const openPositions = await getOpenPositions(accountId);
  const closedPositionsAll = await getAllPositions(accountId, { status: "closed" });

  const currentEquity = parseFloat(account.currentEquity);
  const cashBalance = parseFloat(account.cashBalance);
  const realizedPnl = parseFloat(account.realizedPnl);
  const unrealizedPnl = parseFloat(account.unrealizedPnl);

  // Compute total exposure = sum of open position market values
  const totalExposure = openPositions.reduce(
    (acc, p) => acc + parseFloat(p.marketValue),
    0,
  );

  const allocationPct = currentEquity > 0 ? totalExposure / currentEquity : 0;

  // Track peak equity and drawdown
  const prevPeak = existingPortfolio
    ? parseFloat(existingPortfolio.peakEquity)
    : parseFloat(account.initialCapital);
  const peakEquity = Math.max(prevPeak, currentEquity);
  const currentDrawdownPct = peakEquity > 0 ? (peakEquity - currentEquity) / peakEquity : 0;

  const prevMaxDrawdown = existingPortfolio
    ? parseFloat(existingPortfolio.maxDrawdownPct)
    : 0;
  const maxDrawdownPct = Math.max(prevMaxDrawdown, currentDrawdownPct);

  // Daily return — compared to previous snapshot if available
  const dailyReturnPct = existingPortfolio
    ? parseFloat(existingPortfolio.dailyReturnPct) // will be overwritten by snapshot service
    : 0;

  await upsertPaperPortfolio(accountId, {
    openPositions: openPositions.length,
    closedPositions: closedPositionsAll.length,
    totalExposure: String(totalExposure),
    allocationPct: String(allocationPct),
    peakEquity: String(peakEquity),
    currentDrawdownPct: String(currentDrawdownPct),
    maxDrawdownPct: String(maxDrawdownPct),
    dailyReturnPct: String(dailyReturnPct),
  });

  logger.debug(
    {
      accountId,
      currentEquity,
      totalExposure,
      allocationPct,
      currentDrawdownPct,
    },
    "Portfolio refreshed",
  );

  return {
    accountId,
    openPositions: openPositions.length,
    closedPositions: closedPositionsAll.length,
    totalExposure,
    allocationPct,
    currentEquity,
    cashBalance,
    realizedPnl,
    unrealizedPnl,
    peakEquity,
    currentDrawdownPct,
    maxDrawdownPct,
    dailyReturnPct,
  };
}
