/**
 * Pure technical indicator calculations.
 * All functions operate on plain number arrays and return number arrays.
 * Designed to be called inside strategy generateSignal() methods using the
 * candle history available in StrategyContext — no look-ahead possible.
 */

// ---------------------------------------------------------------------------
// Simple Moving Average
// ---------------------------------------------------------------------------

export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += values[j]!;
    }
    result.push(sum / period);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Exponential Moving Average
// ---------------------------------------------------------------------------

export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      // Seed with SMA of first `period` values
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += values[j]!;
      }
      result.push(sum / period);
      continue;
    }
    const prev = result[result.length - 1]!;
    result.push(values[i]! * k + prev * (1 - k));
  }
  return result;
}

// ---------------------------------------------------------------------------
// RSI — Relative Strength Index
// ---------------------------------------------------------------------------

export function rsi(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length).fill(NaN);

  if (values.length < period + 1) return result;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = values[i]! - values[i - 1]!;
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) {
    result[period] = 100;
  } else {
    result[period] = 100 - 100 / (1 + avgGain / avgLoss);
  }

  for (let i = period + 1; i < values.length; i++) {
    const change = values[i]! - values[i - 1]!;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      result[i] = 100 - 100 / (1 + avgGain / avgLoss);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// MACD — Moving Average Convergence/Divergence
// ---------------------------------------------------------------------------

export interface MacdResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function macd(
  values: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): MacdResult {
  const fastEma = ema(values, fastPeriod);
  const slowEma = ema(values, slowPeriod);

  const macdLine: number[] = values.map((_, i) => {
    const f = fastEma[i]!;
    const s = slowEma[i]!;
    return isNaN(f) || isNaN(s) ? NaN : f - s;
  });

  // Signal line is an EMA of the MACD line — filter out NaNs for seeding
  const macdLineClean = macdLine.map((v) => (isNaN(v) ? 0 : v));
  const rawSignal = ema(macdLineClean, signalPeriod);
  // Propagate NaN from macdLine into signalLine
  const signalLine: number[] = rawSignal.map((v, i) =>
    isNaN(macdLine[i]!) ? NaN : v,
  );

  const histogram: number[] = macdLine.map((m, i) => {
    const s = signalLine[i]!;
    return isNaN(m) || isNaN(s) ? NaN : m - s;
  });

  return { macdLine, signalLine, histogram };
}

// ---------------------------------------------------------------------------
// Bollinger Bands
// ---------------------------------------------------------------------------

export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
  percentB: number[];
}

export function bollingerBands(
  values: number[],
  period: number,
  stdDevMultiplier: number,
): BollingerResult {
  const middle = sma(values, period);
  const upper: number[] = [];
  const lower: number[] = [];
  const bandwidth: number[] = [];
  const percentB: number[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
      bandwidth.push(NaN);
      percentB.push(NaN);
      continue;
    }

    const slice = values.slice(i - period + 1, i + 1);
    const mean = middle[i]!;
    const variance = slice.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / period;
    const stdDev = Math.sqrt(variance);

    const upperVal = mean + stdDevMultiplier * stdDev;
    const lowerVal = mean - stdDevMultiplier * stdDev;
    const bw = mean !== 0 ? (upperVal - lowerVal) / mean : 0;
    const pctB = upperVal !== lowerVal
      ? (values[i]! - lowerVal) / (upperVal - lowerVal)
      : 0.5;

    upper.push(upperVal);
    lower.push(lowerVal);
    bandwidth.push(bw);
    percentB.push(pctB);
  }

  return { upper, middle, lower, bandwidth, percentB };
}

// ---------------------------------------------------------------------------
// Standard deviation of returns (for Sharpe / Sortino)
// ---------------------------------------------------------------------------

export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

export function downsideDeviation(returns: number[], mar: number = 0): number {
  const negativeReturns = returns.filter((r) => r < mar);
  if (negativeReturns.length === 0) return 0;
  const variance =
    negativeReturns.reduce((acc, r) => acc + Math.pow(r - mar, 2), 0) /
    returns.length;
  return Math.sqrt(variance);
}
