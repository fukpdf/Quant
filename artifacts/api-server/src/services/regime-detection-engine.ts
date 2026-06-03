/**
 * regime-detection-engine.ts — Phase 11 Market Regime Detection Engine.
 *
 * Classifies the current market condition for each tracked symbol into one of:
 *   bull | bear | sideways | high_volatility | low_volatility
 *
 * Detection uses a heuristic ensemble approach:
 *   - Trend slope from linear regression on close prices
 *   - Rolling volatility (annualized std dev of returns)
 *   - ADX proxy (smoothed directional movement)
 *   - Average RSI
 *   - Volume ratio (recent vs baseline)
 *   - Net return over the lookback window
 *
 * Advisory only — regime classification informs strategy selection and
 * allocation recommendations but does NOT trigger any trade or order.
 */

import { db } from "@workspace/db";
import { candlesTable } from "@workspace/db/schema";
import { eq, desc, and, gte, asc } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  insertMarketRegime,
  getActiveRegime,
  closeRegime,
  listMarketRegimes,
  getMarketRegimeById,
} from "./intelligence-db";
import type {
  RegimeType,
  DetectedRegime,
  RegimeIndicators,
} from "./intelligence-types";


// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const THRESHOLDS = {
  /** Annualized volatility % above which regime is high_volatility */
  HIGH_VOL: 60,
  /** Annualized volatility % below which regime is low_volatility */
  LOW_VOL: 15,
  /** Trend slope (% per day) above which market is bull */
  BULL_SLOPE: 0.15,
  /** Trend slope (% per day) below which market is bear */
  BEAR_SLOPE: -0.15,
  /** ADX proxy above which trend is directional (bull or bear) */
  ADX_TRENDING: 25,
  /** Default lookback in days */
  DEFAULT_LOOKBACK_DAYS: 30,
  /** Minimum candles required to compute regime */
  MIN_CANDLES: 20,
} as const;

// ---------------------------------------------------------------------------
// Mathematical helpers
// ---------------------------------------------------------------------------

/** Linear regression slope (returns slope in % per unit) */
function linearRegressionSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  return denominator === 0 ? 0 : (numerator / denominator / yMean) * 100;
}

/** Annualized volatility from daily returns */
function annualizedVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** ADX proxy: average of smoothed directional movement index (simplified) */
function adxProxy(highs: number[], lows: number[], closes: number[]): number {
  if (highs.length < 3) return 0;
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    );
    trs.push(tr);
  }
  const avgTR = trs.reduce((a, b) => a + b, 0) / trs.length;
  if (avgTR === 0) return 0;
  const avgPlusDM = plusDMs.reduce((a, b) => a + b, 0) / plusDMs.length;
  const avgMinusDM = minusDMs.reduce((a, b) => a + b, 0) / minusDMs.length;
  const plusDI = (avgPlusDM / avgTR) * 100;
  const minusDI = (avgMinusDM / avgTR) * 100;
  const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
  return isNaN(dx) ? 0 : dx;
}

/** Average RSI over the window */
function avgRsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const rsiValues: number[] = [];
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues.push(100 - 100 / (1 + rs));
  }
  if (rsiValues.length === 0) return 50;
  return rsiValues.reduce((a, b) => a + b, 0) / rsiValues.length;
}

// ---------------------------------------------------------------------------
// Regime Classification Logic
// ---------------------------------------------------------------------------

function classifyRegime(
  indicators: RegimeIndicators,
): { regimeType: RegimeType; confidenceScore: number } {
  const { trend_slope, volatility_pct, adx, rsi_avg, return_pct } = indicators;

  // High volatility takes precedence
  if (volatility_pct > THRESHOLDS.HIGH_VOL) {
    const confidence = Math.min(1, (volatility_pct - THRESHOLDS.HIGH_VOL) / 30 + 0.5);
    return { regimeType: "high_volatility", confidenceScore: parseFloat(confidence.toFixed(4)) };
  }

  // Low volatility
  if (volatility_pct < THRESHOLDS.LOW_VOL) {
    const confidence = Math.min(1, (THRESHOLDS.LOW_VOL - volatility_pct) / 10 + 0.5);
    return { regimeType: "low_volatility", confidenceScore: parseFloat(confidence.toFixed(4)) };
  }

  // Trend direction based on slope, ADX, RSI, and return
  const isTrending = adx > THRESHOLDS.ADX_TRENDING;
  const isBull = trend_slope > THRESHOLDS.BULL_SLOPE && return_pct > 0;
  const isBear = trend_slope < THRESHOLDS.BEAR_SLOPE && return_pct < 0;

  if (isTrending && isBull && rsi_avg > 50) {
    const slopeConf = Math.min(1, (trend_slope - THRESHOLDS.BULL_SLOPE) / 0.3 + 0.5);
    const adxConf = Math.min(1, (adx - THRESHOLDS.ADX_TRENDING) / 20 + 0.4);
    return {
      regimeType: "bull",
      confidenceScore: parseFloat(((slopeConf + adxConf) / 2).toFixed(4)),
    };
  }

  if (isTrending && isBear && rsi_avg < 50) {
    const slopeConf = Math.min(1, (Math.abs(trend_slope) - Math.abs(THRESHOLDS.BEAR_SLOPE)) / 0.3 + 0.5);
    const adxConf = Math.min(1, (adx - THRESHOLDS.ADX_TRENDING) / 20 + 0.4);
    return {
      regimeType: "bear",
      confidenceScore: parseFloat(((slopeConf + adxConf) / 2).toFixed(4)),
    };
  }

  // Default: sideways
  const flatConf = Math.min(1, 1 - Math.abs(trend_slope) / 0.3);
  return {
    regimeType: "sideways",
    confidenceScore: Math.max(0.3, parseFloat(flatConf.toFixed(4))),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect the current regime for a symbol using recent candle data.
 * Returns the detected regime without persisting it.
 */
export async function detectRegime(
  symbol: string,
  lookbackDays: number = THRESHOLDS.DEFAULT_LOOKBACK_DAYS,
): Promise<DetectedRegime | null> {
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const candles = await db
    .select()
    .from(candlesTable)
    .where(
      and(
        eq(candlesTable.symbol, symbol),
        gte(candlesTable.timestamp, since),
      ),
    )
    .orderBy(asc(candlesTable.timestamp))
    .limit(500);

  if (candles.length < THRESHOLDS.MIN_CANDLES) {
    logger.warn({ symbol, count: candles.length }, "Insufficient candles for regime detection");
    return null;
  }

  const closes = candles.map((c) => parseFloat(c.close));
  const highs = candles.map((c) => parseFloat(c.high));
  const lows = candles.map((c) => parseFloat(c.low));
  const volumes = candles.map((c) => parseFloat(c.volume));

  const trend_slope = linearRegressionSlope(closes);
  const volatility_pct = annualizedVolatility(closes);
  const adx = adxProxy(highs, lows, closes);
  const rsi_avg = avgRsi(closes);
  const return_pct = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
  const recentVolume = volumes.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const baselineVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volume_ratio = baselineVolume > 0 ? recentVolume / baselineVolume : 1;

  const indicators: RegimeIndicators = {
    trend_slope: parseFloat(trend_slope.toFixed(4)),
    volatility_pct: parseFloat(volatility_pct.toFixed(2)),
    adx: parseFloat(adx.toFixed(2)),
    rsi_avg: parseFloat(rsi_avg.toFixed(2)),
    volume_ratio: parseFloat(volume_ratio.toFixed(4)),
    return_pct: parseFloat(return_pct.toFixed(4)),
  };

  const { regimeType, confidenceScore } = classifyRegime(indicators);

  return {
    symbol,
    regimeType,
    confidenceScore,
    indicators,
    detectionMethod: "heuristic",
    lookbackDays,
  };
}

/**
 * Detect and persist the regime for a symbol.
 * Closes any previous active regime for the symbol if the type changed.
 */
export async function detectAndPersistRegime(
  symbol: string,
  lookbackDays: number = THRESHOLDS.DEFAULT_LOOKBACK_DAYS,
) {
  const detected = await detectRegime(symbol, lookbackDays);
  if (!detected) return null;

  const current = await getActiveRegime(symbol);

  // If regime changed, close the previous one
  if (current && current.regimeType !== detected.regimeType) {
    await closeRegime(current.id);
    logger.info(
      { symbol, from: current.regimeType, to: detected.regimeType },
      "Regime transition detected",
    );
  }

  // If same regime type is already active, just return the existing record
  if (current && current.regimeType === detected.regimeType) {
    return current;
  }

  // Insert new regime record
  const regime = await insertMarketRegime({
    symbol,
    regimeType: detected.regimeType,
    confidenceScore: detected.confidenceScore.toString(),
    startAt: new Date(),
    status: "active",
    detectionMethod: detected.detectionMethod,
    lookbackDays: lookbackDays.toString(),
    indicators: detected.indicators as unknown as Record<string, unknown>,
    metadata: {},
    detectedAt: new Date(),
  });

  logger.info({ symbol, regimeType: detected.regimeType, confidenceScore: detected.confidenceScore }, "Regime persisted");
  return regime;
}

/**
 * Run regime detection for a list of symbols.
 */
export async function runRegimeDetectionForSymbols(symbols: string[]) {
  const results = await Promise.allSettled(
    symbols.map((sym) => detectAndPersistRegime(sym)),
  );

  const summary = { detected: 0, failed: 0, symbols: [] as string[] };
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      summary.detected++;
      summary.symbols.push(r.value.symbol);
    } else {
      summary.failed++;
    }
  }

  logger.info(summary, "Regime detection sweep complete");
  return summary;
}

export { getActiveRegime, listMarketRegimes, getMarketRegimeById };
