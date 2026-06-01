import { listPaperTrades, getPaperAccount, listDailySnapshots } from "./paper-accounts-db";

/**
 * Paper Performance Analytics — Phase 5.
 *
 * Computes performance metrics from completed paper trades and daily snapshots.
 * Reuses the same metric formulas as the backtesting engine where applicable.
 *
 * Metrics:
 *   - Daily / Weekly / Monthly / YTD return
 *   - Sharpe ratio (from daily returns)
 *   - Max drawdown
 *   - Win rate
 *   - Profit factor
 *   - Average trade P&L
 *   - Largest win / largest loss
 */

export interface PaperPerformanceMetrics {
  accountId: string;
  totalReturnPct: number;
  dailyReturnPct: number;
  weeklyReturnPct: number;
  monthlyReturnPct: number;
  ytdReturnPct: number;
  sharpeRatio: number | null;
  maxDrawdownPct: number;
  winRate: number;
  profitFactor: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgTradePnl: number;
  avgWinPnl: number | null;
  avgLossPnl: number | null;
  largestWin: number;
  largestLoss: number;
  totalRealizedPnl: number;
  totalCommission: number;
  totalSlippage: number;
}

/**
 * Compute performance metrics for a paper account.
 * Uses trade history + daily snapshots for time-windowed returns.
 */
export async function computePaperPerformance(
  accountId: string,
): Promise<PaperPerformanceMetrics | null> {
  const account = await getPaperAccount(accountId);
  if (!account) return null;

  const trades = await listPaperTrades(accountId, { limit: 10_000 });
  const snapshots = await listDailySnapshots(accountId, { limit: 400 });

  const initialCapital = parseFloat(account.initialCapital);
  const currentEquity = parseFloat(account.currentEquity);
  const totalReturnPct = initialCapital > 0 ? (currentEquity - initialCapital) / initialCapital : 0;

  // ---------------------------------------------------------------------------
  // Trade-level metrics
  // ---------------------------------------------------------------------------
  const netPnls = trades.map((t) => parseFloat(t.netPnl));
  const wins = netPnls.filter((p) => p > 0);
  const losses = netPnls.filter((p) => p <= 0);

  const totalTrades = trades.length;
  const winningTrades = wins.length;
  const losingTrades = losses.length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

  const grossProfit = wins.reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(losses.reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  const avgTradePnl = totalTrades > 0 ? netPnls.reduce((a, b) => a + b, 0) / totalTrades : 0;
  const avgWinPnl = wins.length > 0 ? grossProfit / wins.length : null;
  const avgLossPnl = losses.length > 0 ? -grossLoss / losses.length : null;
  const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
  const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;

  const totalRealizedPnl = parseFloat(account.realizedPnl);
  const totalCommission = trades.reduce((a, t) => a + parseFloat(t.commission), 0);
  const totalSlippage = trades.reduce((a, t) => a + parseFloat(t.slippage), 0);

  // ---------------------------------------------------------------------------
  // Snapshot-based time-windowed returns
  // ---------------------------------------------------------------------------
  const sortedSnapshots = [...snapshots].sort(
    (a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime(),
  );

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  function getEquityAt(date: Date): number {
    const snaps = sortedSnapshots.filter(
      (s) => new Date(s.snapshotDate).getTime() <= date.getTime(),
    );
    if (snaps.length === 0) return initialCapital;
    return parseFloat(snaps[snaps.length - 1]!.equity);
  }

  const equityDayAgo = getEquityAt(dayAgo);
  const equityWeekAgo = getEquityAt(weekAgo);
  const equityMonthAgo = getEquityAt(monthAgo);
  const equityYearStart = getEquityAt(yearStart);

  const safeReturn = (prev: number, curr: number) =>
    prev > 0 ? (curr - prev) / prev : 0;

  const dailyReturnPct = safeReturn(equityDayAgo, currentEquity);
  const weeklyReturnPct = safeReturn(equityWeekAgo, currentEquity);
  const monthlyReturnPct = safeReturn(equityMonthAgo, currentEquity);
  const ytdReturnPct = safeReturn(equityYearStart, currentEquity);

  // ---------------------------------------------------------------------------
  // Sharpe ratio from daily snapshot returns
  // ---------------------------------------------------------------------------
  let sharpeRatio: number | null = null;
  if (sortedSnapshots.length >= 5) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < sortedSnapshots.length; i++) {
      const prev = parseFloat(sortedSnapshots[i - 1]!.equity);
      const curr = parseFloat(sortedSnapshots[i]!.equity);
      if (prev > 0) dailyReturns.push((curr - prev) / prev);
    }
    if (dailyReturns.length >= 3) {
      const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce((a, r) => a + Math.pow(r - mean, 2), 0) / dailyReturns.length;
      const sd = Math.sqrt(variance);
      if (sd > 0) {
        sharpeRatio = (mean / sd) * Math.sqrt(252);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Max drawdown from snapshots
  // ---------------------------------------------------------------------------
  let maxDrawdownPct = 0;
  let peak = initialCapital;
  for (const snap of sortedSnapshots) {
    const equity = parseFloat(snap.equity);
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  return {
    accountId,
    totalReturnPct,
    dailyReturnPct,
    weeklyReturnPct,
    monthlyReturnPct,
    ytdReturnPct,
    sharpeRatio,
    maxDrawdownPct,
    winRate,
    profitFactor,
    totalTrades,
    winningTrades,
    losingTrades,
    avgTradePnl,
    avgWinPnl,
    avgLossPnl,
    largestWin,
    largestLoss,
    totalRealizedPnl,
    totalCommission,
    totalSlippage,
  };
}
