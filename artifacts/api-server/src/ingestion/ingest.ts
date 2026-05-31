import { logger } from "../lib/logger";
import { binanceClient } from "../services/binance";
import { normalizeBinanceKlines, filterValidCandles } from "../services/normalizer";
import {
  insertCandles,
  listMarkets,
  logIngestion,
  countCandles,
} from "../services/market-data";

/**
 * Ingestion configuration per interval.
 * limit: how many candles to fetch per run (incremental)
 * backfillLimit: how many candles to fetch on first-ever ingestion
 */
const INGEST_CONFIG: Record<string, { limit: number; backfillLimit: number }> = {
  "1h": { limit: 10, backfillLimit: 500 },
  "1d": { limit: 5, backfillLimit: 365 },
};

export const ACTIVE_INTERVALS = Object.keys(INGEST_CONFIG);

/**
 * Ingest candles for a single symbol + interval from Binance.
 * Uses upsert (onConflictDoNothing) — safe to call multiple times.
 */
export async function ingestSymbol(
  symbol: string,
  interval: string,
): Promise<{ fetched: number; inserted: number }> {
  const config = INGEST_CONFIG[interval] ?? { limit: 10, backfillLimit: 200 };
  const start = Date.now();

  const existingCount = await countCandles(symbol, interval);
  const isFirstRun = existingCount === 0;
  const limit = isFirstRun ? config.backfillLimit : config.limit;

  logger.debug(
    { symbol, interval, limit, isFirstRun },
    "Ingesting candles",
  );

  try {
    const klines = await binanceClient.fetchKlines({ symbol, interval, limit });
    const candles = normalizeBinanceKlines(klines, symbol, interval);
    const valid = filterValidCandles(candles, "binance");
    const inserted = await insertCandles(valid);

    await logIngestion({
      source: "binance",
      symbol,
      interval,
      status: "success",
      candlesFetched: valid.length,
      candlesInserted: inserted,
      durationMs: Date.now() - start,
    });

    logger.info(
      { symbol, interval, fetched: valid.length, inserted },
      "Ingestion complete",
    );

    return { fetched: valid.length, inserted };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    logger.error({ symbol, interval, err: errorMessage }, "Ingestion failed");

    await logIngestion({
      source: "binance",
      symbol,
      interval,
      status: "failed",
      candlesFetched: 0,
      candlesInserted: 0,
      errorMessage,
      durationMs: Date.now() - start,
    }).catch(() => {
      // Best-effort — don't crash if log write fails
    });

    return { fetched: 0, inserted: 0 };
  }
}

/**
 * Ingest all active crypto markets for all configured intervals.
 * Called by the scheduler on each tick.
 */
export async function ingestAllActive(): Promise<void> {
  const markets = await listMarkets({ active: true, type: "crypto" });

  if (markets.length === 0) {
    logger.warn("No active crypto markets to ingest");
    return;
  }

  logger.info(
    { markets: markets.map((m) => m.symbol), intervals: ACTIVE_INTERVALS },
    "Starting ingestion cycle",
  );

  for (const market of markets) {
    for (const interval of ACTIVE_INTERVALS) {
      // Sequential per symbol to avoid rate limits — Binance allows ~1200 req/min
      await ingestSymbol(market.symbol, interval);
      // Small delay between requests to be a good API citizen
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  logger.info({ marketCount: markets.length }, "Ingestion cycle complete");
}
