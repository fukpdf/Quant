/**
 * Position sizing framework — Phase 4.
 *
 * All methods are research-only (simulation). No real capital is allocated.
 * Each method determines how much of the available portfolio equity to
 * commit to a single trade entry.
 */

import type { OhlcvCandle } from "../strategies/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PositionSizingMethod =
  | "fixed_dollar"
  | "fixed_percentage"
  | "risk_percentage"
  | "volatility_based"
  | "kelly";

export interface PositionSizingConfig {
  method: PositionSizingMethod;
  /** Primary value: dollars (fixed_dollar), fraction (others) */
  value: number;
  /** Hard cap: max fraction of equity per position (0-1) */
  maxPositionPct: number;
  /** ATR lookback period (for risk_percentage and volatility_based) */
  atrPeriod: number;
  /** Multiple of ATR used as hypothetical stop distance */
  atrRiskMultiple: number;
  /** Kelly fraction multiplier (0.25 = quarter Kelly) */
  kellyFraction: number;
}

/** Default: 100% of equity (Phase 3 backward-compatible) */
export const FULL_POSITION_CONFIG: PositionSizingConfig = {
  method: "fixed_percentage",
  value: 1.0,
  maxPositionPct: 1.0,
  atrPeriod: 14,
  atrRiskMultiple: 2.0,
  kellyFraction: 0.25,
};

export interface PositionSizeResult {
  /** Fraction of current equity to commit (0-1) */
  equityFraction: number;
  /** Dollar value to commit */
  dollarSize: number;
  /** Number of units (shares/coins) to buy at entryPrice */
  quantity: number;
}

// ---------------------------------------------------------------------------
// ATR helper
// ---------------------------------------------------------------------------

/**
 * Compute Average True Range using Wilder's smoothing.
 * Returns 0 if there are not enough candles.
 */
export function computeATR(candles: OhlcvCandle[], period: number): number {
  if (candles.length < 2) return 0;

  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i]!;
    const prev = candles[i - 1]!;
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close),
    );
    trs.push(tr);
  }

  if (trs.length === 0) return 0;

  // Simple average for first ATR value, then Wilder's smoothing
  const initialTrs = trs.slice(0, period);
  if (initialTrs.length === 0) return 0;

  let atr = initialTrs.reduce((a, b) => a + b, 0) / initialTrs.length;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]!) / period;
  }

  return atr;
}

// ---------------------------------------------------------------------------
// Kelly Criterion
// ---------------------------------------------------------------------------

/**
 * Full Kelly fraction: f* = (win_rate * avg_win - (1-win_rate) * |avg_loss|) / avg_win
 * Returns 0 if insufficient data or negative Kelly.
 */
export function computeKellyFraction(
  winRate: number,
  avgWinPct: number,
  avgLossPct: number,
): number {
  if (avgWinPct <= 0 || winRate <= 0) return 0;
  const absLoss = Math.abs(avgLossPct);
  const kelly = (winRate * avgWinPct - (1 - winRate) * absLoss) / avgWinPct;
  return Math.max(0, kelly);
}

// ---------------------------------------------------------------------------
// Main sizing function
// ---------------------------------------------------------------------------

/**
 * Compute the position size for the next trade.
 *
 * @param currentEquity - total portfolio equity at the moment of entry
 * @param entryPrice - expected fill price of the entry order
 * @param config - position sizing configuration
 * @param candles - candles visible up to and including the signal candle
 * @param winRate - historical win rate (required for Kelly)
 * @param avgWinPct - historical average win (required for Kelly)
 * @param avgLossPct - historical average loss (required for Kelly)
 */
export function computePositionSize(
  currentEquity: number,
  entryPrice: number,
  config: PositionSizingConfig,
  candles: OhlcvCandle[] = [],
  winRate = 0.5,
  avgWinPct = 0.02,
  avgLossPct = -0.01,
): PositionSizeResult {
  let equityFraction = 0;

  switch (config.method) {
    case "fixed_dollar": {
      equityFraction = currentEquity > 0 ? config.value / currentEquity : 0;
      break;
    }
    case "fixed_percentage": {
      equityFraction = config.value;
      break;
    }
    case "risk_percentage": {
      // Size so that a stop-loss at ATR distance = config.value * equity
      const atr = computeATR(candles, config.atrPeriod);
      if (atr > 0 && entryPrice > 0) {
        const stopDistance = atr * config.atrRiskMultiple;
        const riskPerUnit = stopDistance;
        const riskAmount = currentEquity * config.value;
        const units = riskAmount / riskPerUnit;
        const dollarCommit = units * entryPrice;
        equityFraction = currentEquity > 0 ? dollarCommit / currentEquity : 0;
      } else {
        equityFraction = config.value;
      }
      break;
    }
    case "volatility_based": {
      // Size inversely proportional to ATR (lower vol → larger position)
      const atr = computeATR(candles, config.atrPeriod);
      if (atr > 0 && entryPrice > 0) {
        const atrPct = atr / entryPrice;
        const targetVolatility = config.value;
        equityFraction = atrPct > 0 ? Math.min(targetVolatility / atrPct, 1.0) : config.value;
      } else {
        equityFraction = config.value;
      }
      break;
    }
    case "kelly": {
      const rawKelly = computeKellyFraction(winRate, avgWinPct, avgLossPct);
      equityFraction = rawKelly * config.kellyFraction;
      break;
    }
    default:
      equityFraction = 1.0;
  }

  // Apply hard cap
  equityFraction = Math.max(0, Math.min(equityFraction, config.maxPositionPct));

  const dollarSize = currentEquity * equityFraction;
  const quantity = entryPrice > 0 ? dollarSize / entryPrice : 0;

  return { equityFraction, dollarSize, quantity };
}
