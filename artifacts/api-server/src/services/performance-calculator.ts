import type { SimulatedTrade, EquityCurvePoint } from "../strategies/types";
import { stdDev, downsideDeviation } from "../strategies/indicators";
import {
  calculateAdvancedMetrics,
  type AdvancedMetrics,
} from "./advanced-metrics";

/**
 * Performance metrics calculator — Phase 4 upgrade.
 * Takes completed trades and an equity curve and produces risk-adjusted metrics.
 * All percentage outputs are expressed as decimal fractions (0.15 = 15%).
 */

export interface ComputedMetrics {
  // --- Phase 3 metrics ---
  totalReturnPct: number;
  annualizedReturnPct: number | null;
  winRate: number;
  profitFactor: number | null;
  avgWinPct: number | null;
  avgLossPct: number | null;
  maxDrawdownPct: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  expectancy: number | null;
  // --- Phase 4 additions ---
  calmarRatio: number | null;
  recoveryFactor: number | null;
  ulcerIndex: number | null;
  marRatio: number | null;
  exposureTimePct: number | null;
  avgTradeDurationDays: number | null;
  ulcerPerformanceIndex: number | null;
  probabilityOfRuin: number | null;
  /** Total commission paid across all trades (absolute dollars) */
  totalCommission: number;
  /** Total slippage impact across all trades (absolute dollars) */
  totalSlippage: number;
}

const RISK_FREE_RATE_ANNUAL = 0.0;
const TRADING_DAYS_PER_YEAR = 252;

export function calculateMetrics(
  trades: SimulatedTrade[],
  equityCurve: EquityCurvePoint[],
  initialCapital: number,
  totalCommission = 0,
  totalSlippage = 0,
): ComputedMetrics {
  const completedTrades = trades.filter((t) => t.pnl !== null && t.pnlPct !== null);
  const totalTrades = completedTrades.length;

  // ---------------------------------------------------------------------------
  // Win/Loss split
  // ---------------------------------------------------------------------------
  const winners = completedTrades.filter((t) => (t.pnl ?? 0) > 0);
  const losers = completedTrades.filter((t) => (t.pnl ?? 0) <= 0);
  const winningTrades = winners.length;
  const losingTrades = losers.length;
  const winRate = totalTrades > 0 ? winningTrades / totalTrades : 0;

  // ---------------------------------------------------------------------------
  // Total return
  // ---------------------------------------------------------------------------
  const finalEquity =
    equityCurve.length > 0 ? equityCurve[equityCurve.length - 1]!.equity : initialCapital;
  const totalReturnPct = (finalEquity - initialCapital) / initialCapital;

  // ---------------------------------------------------------------------------
  // Annualized return (CAGR)
  // ---------------------------------------------------------------------------
  let annualizedReturnPct: number | null = null;
  if (equityCurve.length >= 2) {
    const startTime = equityCurve[0]!.timestamp.getTime();
    const endTime = equityCurve[equityCurve.length - 1]!.timestamp.getTime();
    const daysElapsed = (endTime - startTime) / (1000 * 60 * 60 * 24);
    if (daysElapsed >= 1) {
      const yearsElapsed = daysElapsed / 365.25;
      annualizedReturnPct = Math.pow(1 + totalReturnPct, 1 / yearsElapsed) - 1;
    }
  }

  // ---------------------------------------------------------------------------
  // Average win / loss
  // ---------------------------------------------------------------------------
  const avgWinPct =
    winningTrades > 0
      ? winners.reduce((acc, t) => acc + (t.pnlPct ?? 0), 0) / winningTrades
      : null;
  const avgLossPct =
    losingTrades > 0
      ? losers.reduce((acc, t) => acc + (t.pnlPct ?? 0), 0) / losingTrades
      : null;

  // ---------------------------------------------------------------------------
  // Profit factor = gross profit / gross loss
  // ---------------------------------------------------------------------------
  const grossProfit = winners.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losers.reduce((acc, t) => acc + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : null;

  // ---------------------------------------------------------------------------
  // Max drawdown — computed from equity curve
  // ---------------------------------------------------------------------------
  let maxDrawdownPct = 0;
  let peak = -Infinity;
  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak > 0 ? (peak - point.equity) / peak : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  // ---------------------------------------------------------------------------
  // Sharpe + Sortino — daily equity returns
  // ---------------------------------------------------------------------------
  let sharpeRatio: number | null = null;
  let sortinoRatio: number | null = null;

  if (equityCurve.length >= 3) {
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1]!.equity;
      const curr = equityCurve[i]!.equity;
      if (prev > 0) dailyReturns.push((curr - prev) / prev);
    }

    if (dailyReturns.length >= 2) {
      const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
      const sd = stdDev(dailyReturns);
      const dailyRiskFree = RISK_FREE_RATE_ANNUAL / TRADING_DAYS_PER_YEAR;

      if (sd > 0) {
        sharpeRatio = ((meanReturn - dailyRiskFree) / sd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
      }

      const dd = downsideDeviation(dailyReturns, dailyRiskFree);
      if (dd > 0) {
        sortinoRatio =
          ((meanReturn - dailyRiskFree) / dd) * Math.sqrt(TRADING_DAYS_PER_YEAR);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Expectancy
  // ---------------------------------------------------------------------------
  let expectancy: number | null = null;
  if (avgWinPct !== null && avgLossPct !== null) {
    expectancy = avgWinPct * winRate + avgLossPct * (1 - winRate);
  }

  // ---------------------------------------------------------------------------
  // Advanced metrics (Phase 4)
  // ---------------------------------------------------------------------------
  const advanced: AdvancedMetrics = calculateAdvancedMetrics(
    completedTrades,
    equityCurve,
    equityCurve.length,
    annualizedReturnPct,
    totalReturnPct,
    maxDrawdownPct,
  );

  return {
    totalReturnPct,
    annualizedReturnPct,
    winRate,
    profitFactor,
    avgWinPct,
    avgLossPct,
    maxDrawdownPct,
    sharpeRatio,
    sortinoRatio,
    totalTrades,
    winningTrades,
    losingTrades,
    expectancy,
    calmarRatio: advanced.calmarRatio,
    recoveryFactor: advanced.recoveryFactor,
    ulcerIndex: advanced.ulcerIndex,
    marRatio: advanced.marRatio,
    exposureTimePct: advanced.exposureTimePct,
    avgTradeDurationDays: advanced.avgTradeDurationDays,
    ulcerPerformanceIndex: advanced.ulcerPerformanceIndex,
    probabilityOfRuin: null,
    totalCommission,
    totalSlippage,
  };
}
