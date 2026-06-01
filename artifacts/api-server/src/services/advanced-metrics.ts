/**
 * Advanced performance metrics — Phase 4.
 *
 * Extends the Phase 3 ComputedMetrics with institutional-grade risk measures.
 * All input values must be pre-computed from the backtesting engine output.
 */

import type { SimulatedTrade, EquityCurvePoint } from "../strategies/types";
import { stdDev } from "../strategies/indicators";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AdvancedMetrics {
  /** CAGR / maxDrawdown — measures return relative to worst drawdown */
  calmarRatio: number | null;
  /** totalReturn / maxDrawdown — how many times the max loss was recovered */
  recoveryFactor: number | null;
  /** RMS of drawdown time-series — penalises prolonged drawdowns */
  ulcerIndex: number | null;
  /** CAGR / maxDrawdown (MAR uses longest common convention = Calmar here) */
  marRatio: number | null;
  /** Fraction of candles where a position was open */
  exposureTimePct: number | null;
  /** Average trade duration in calendar days */
  avgTradeDurationDays: number | null;
  /** Return / Ulcer Index — Sharpe-like but uses Ulcer Index as risk measure */
  ulcerPerformanceIndex: number | null;
  /** Probability of ruin placeholder (populated by Monte Carlo) */
  probabilityOfRuin: number | null;
}

// ---------------------------------------------------------------------------
// Calmar Ratio
// ---------------------------------------------------------------------------

export function computeCalmarRatio(
  annualizedReturnPct: number | null,
  maxDrawdownPct: number,
): number | null {
  if (annualizedReturnPct === null) return null;
  if (maxDrawdownPct <= 0) return null;
  return annualizedReturnPct / maxDrawdownPct;
}

// ---------------------------------------------------------------------------
// Recovery Factor
// ---------------------------------------------------------------------------

export function computeRecoveryFactor(
  totalReturnPct: number,
  maxDrawdownPct: number,
): number | null {
  if (maxDrawdownPct <= 0) return null;
  return totalReturnPct / maxDrawdownPct;
}

// ---------------------------------------------------------------------------
// Ulcer Index
// ---------------------------------------------------------------------------

/**
 * Ulcer Index = sqrt( mean( drawdown_i^2 ) ) across all equity curve points.
 * Drawdown_i is measured as a percentage decline from the running peak.
 */
export function computeUlcerIndex(equityCurve: EquityCurvePoint[]): number | null {
  if (equityCurve.length < 2) return null;

  let peak = -Infinity;
  const squaredDrawdowns: number[] = [];

  for (const point of equityCurve) {
    if (point.equity > peak) peak = point.equity;
    const drawdownPct = peak > 0 ? (peak - point.equity) / peak : 0;
    squaredDrawdowns.push(drawdownPct * drawdownPct);
  }

  if (squaredDrawdowns.length === 0) return null;
  const mean = squaredDrawdowns.reduce((a, b) => a + b, 0) / squaredDrawdowns.length;
  return Math.sqrt(mean);
}

// ---------------------------------------------------------------------------
// Exposure Time
// ---------------------------------------------------------------------------

/**
 * Fraction of total candles in which a position was open.
 * Estimated from the trades' candle index ranges.
 */
export function computeExposureTime(
  trades: SimulatedTrade[],
  totalCandles: number,
): number | null {
  if (totalCandles === 0) return null;

  let candlesInPosition = 0;
  for (const trade of trades) {
    const entry = trade.candleIndexEntry;
    const exit = trade.candleIndexExit ?? trade.candleIndexEntry;
    candlesInPosition += Math.max(0, exit - entry + 1);
  }

  return Math.min(1.0, candlesInPosition / totalCandles);
}

// ---------------------------------------------------------------------------
// Average Trade Duration
// ---------------------------------------------------------------------------

export function computeAvgTradeDurationDays(trades: SimulatedTrade[]): number | null {
  const completedTrades = trades.filter((t) => t.exitTime !== null);
  if (completedTrades.length === 0) return null;

  const totalDays =
    completedTrades.reduce((acc, t) => {
      const ms =
        (t.exitTime?.getTime() ?? t.entryTime.getTime()) - t.entryTime.getTime();
      return acc + ms / (1000 * 60 * 60 * 24);
    }, 0) / completedTrades.length;

  return totalDays;
}

// ---------------------------------------------------------------------------
// Ulcer Performance Index (UPI)
// ---------------------------------------------------------------------------

export function computeUlcerPerformanceIndex(
  annualizedReturnPct: number | null,
  ulcerIndex: number | null,
): number | null {
  if (annualizedReturnPct === null || ulcerIndex === null || ulcerIndex <= 0) return null;
  return annualizedReturnPct / ulcerIndex;
}

// ---------------------------------------------------------------------------
// Main computation entry point
// ---------------------------------------------------------------------------

export function calculateAdvancedMetrics(
  trades: SimulatedTrade[],
  equityCurve: EquityCurvePoint[],
  totalCandles: number,
  annualizedReturnPct: number | null,
  totalReturnPct: number,
  maxDrawdownPct: number,
): AdvancedMetrics {
  const calmarRatio = computeCalmarRatio(annualizedReturnPct, maxDrawdownPct);
  const recoveryFactor = computeRecoveryFactor(totalReturnPct, maxDrawdownPct);
  const ulcerIndex = computeUlcerIndex(equityCurve);
  const marRatio = calmarRatio; // MAR and Calmar use the same formula; distinction is conventional
  const exposureTimePct = computeExposureTime(trades, totalCandles);
  const avgTradeDurationDays = computeAvgTradeDurationDays(trades);
  const ulcerPerformanceIndex = computeUlcerPerformanceIndex(annualizedReturnPct, ulcerIndex);

  return {
    calmarRatio,
    recoveryFactor,
    ulcerIndex,
    marRatio,
    exposureTimePct,
    avgTradeDurationDays,
    ulcerPerformanceIndex,
    probabilityOfRuin: null, // populated by Monte Carlo
  };
}
