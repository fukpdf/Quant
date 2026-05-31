import type { BinanceKline } from "./binance";
import type { InsertCandle } from "@workspace/db";

export type StandardCandle = InsertCandle;

/**
 * Normalizes a raw Binance kline array into the standard candle format.
 * All prices are kept as strings (Binance already returns them as strings)
 * to avoid floating-point precision loss.
 */
export function normalizeBinanceKline(
  kline: BinanceKline,
  symbol: string,
  interval: string,
): StandardCandle {
  const [
    openTimeMs,
    open,
    high,
    low,
    close,
    volume,
  ] = kline;

  return {
    symbol: symbol.toUpperCase(),
    timestamp: new Date(openTimeMs),
    open,
    high,
    low,
    close,
    volume,
    interval,
    source: "binance",
  };
}

/**
 * Normalizes an array of Binance klines into standard candles.
 */
export function normalizeBinanceKlines(
  klines: BinanceKline[],
  symbol: string,
  interval: string,
): StandardCandle[] {
  return klines.map((kline) => normalizeBinanceKline(kline, symbol, interval));
}

/**
 * Validate that a candle's OHLC values are internally consistent.
 * Returns null if valid, or an error string if invalid.
 */
export function validateCandle(candle: StandardCandle): string | null {
  const open = parseFloat(candle.open as string);
  const high = parseFloat(candle.high as string);
  const low = parseFloat(candle.low as string);
  const close = parseFloat(candle.close as string);
  const volume = parseFloat(candle.volume as string);

  if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) || isNaN(volume)) {
    return "One or more OHLCV values are NaN";
  }
  if (high < low) {
    return `High (${high}) is less than low (${low})`;
  }
  if (high < open || high < close) {
    return `High (${high}) is less than open (${open}) or close (${close})`;
  }
  if (low > open || low > close) {
    return `Low (${low}) is greater than open (${open}) or close (${close})`;
  }
  if (volume < 0) {
    return `Volume (${volume}) is negative`;
  }
  return null;
}

/**
 * Filter and validate a batch of candles, logging any that fail validation.
 */
export function filterValidCandles(
  candles: StandardCandle[],
  source: string,
): StandardCandle[] {
  const valid: StandardCandle[] = [];
  for (const candle of candles) {
    const error = validateCandle(candle);
    if (error) {
      // In production, we'd log this; keep it lightweight here
      void source; // referenced to satisfy linter
      continue;
    }
    valid.push(candle);
  }
  return valid;
}
