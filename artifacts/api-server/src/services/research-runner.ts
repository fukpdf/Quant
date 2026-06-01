import { queryCandles } from "./market-data";
import { runBacktest } from "./backtesting-engine";
import { calculateMetrics } from "./performance-calculator";
import {
  createBacktestRun,
  updateBacktestRunStatus,
  saveBacktestTrades,
  savePerformanceMetrics,
} from "./research-db";
import { createStrategy, resolveParams } from "../strategies/registry";
import type { OhlcvCandle, StrategyParams } from "../strategies/types";
import { logger } from "../lib/logger";

export interface BacktestRequest {
  strategyName: string;
  symbol: string;
  interval: string;
  startDate: Date;
  endDate: Date;
  params?: Partial<StrategyParams>;
  initialCapital?: number;
}

export interface BacktestJobResult {
  runId: string;
  status: "completed" | "failed";
  errorMessage?: string;
}

/**
 * Executes a full backtest research job:
 *  1. Validate the strategy exists.
 *  2. Create a DB record (pending).
 *  3. Load historical candles from the candles table.
 *  4. Run the backtest engine.
 *  5. Calculate performance metrics.
 *  6. Persist trades and metrics.
 *  7. Update run status to completed or failed.
 *
 * Runs synchronously inside the HTTP request handler — suitable for the current
 * phase workload. Async job queue will be introduced in a later phase when needed.
 */
export async function executeBacktest(
  request: BacktestRequest,
): Promise<BacktestJobResult> {
  const {
    strategyName,
    symbol,
    interval,
    startDate,
    endDate,
    params = {},
    initialCapital = 10_000,
  } = request;

  // ---------------------------------------------------------------------------
  // Validate strategy
  // ---------------------------------------------------------------------------
  const strategy = createStrategy(strategyName); // throws if unknown
  const resolvedParams = resolveParams(strategy, params);

  // ---------------------------------------------------------------------------
  // Persist the run record
  // ---------------------------------------------------------------------------
  const run = await createBacktestRun({
    strategyName,
    symbol: symbol.toUpperCase(),
    interval,
    startDate,
    endDate,
    parameters: JSON.stringify(resolvedParams),
    completedAt: null,
    errorMessage: null,
  });

  const runId = run.id;
  logger.info({ runId, strategyName, symbol, interval }, "Starting backtest run");

  try {
    await updateBacktestRunStatus(runId, "running");

    // -------------------------------------------------------------------------
    // Load candles from the historical data store
    // -------------------------------------------------------------------------
    const rawCandles = await queryCandles({
      symbol: symbol.toUpperCase(),
      interval,
      startTime: startDate,
      endTime: endDate,
      limit: 10_000,
    });

    if (rawCandles.length === 0) {
      throw new Error(
        `No candle data found for ${symbol} ${interval} between ${startDate.toISOString()} and ${endDate.toISOString()}`,
      );
    }

    // Convert Drizzle candle rows → OhlcvCandle
    const candles: OhlcvCandle[] = rawCandles
      .map((c) => ({
        timestamp: c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp),
        open: parseFloat(String(c.open)),
        high: parseFloat(String(c.high)),
        low: parseFloat(String(c.low)),
        close: parseFloat(String(c.close)),
        volume: parseFloat(String(c.volume)),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()); // ensure chronological order

    // -------------------------------------------------------------------------
    // Run the backtest engine
    // -------------------------------------------------------------------------
    const { trades, equityCurve, candlesProcessed } = await runBacktest({
      candles,
      strategy,
      params: resolvedParams,
      initialCapital,
    });

    // -------------------------------------------------------------------------
    // Calculate metrics
    // -------------------------------------------------------------------------
    const metrics = calculateMetrics(trades, equityCurve, initialCapital);

    // -------------------------------------------------------------------------
    // Persist results
    // -------------------------------------------------------------------------
    await saveBacktestTrades(runId, trades);
    await savePerformanceMetrics(runId, metrics);
    await updateBacktestRunStatus(runId, "completed", {
      candlesProcessed,
      completedAt: new Date(),
    });

    logger.info(
      {
        runId,
        candlesProcessed,
        totalTrades: metrics.totalTrades,
        totalReturnPct: metrics.totalReturnPct,
      },
      "Backtest run completed",
    );

    return { runId, status: "completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ runId, err }, "Backtest run failed");

    await updateBacktestRunStatus(runId, "failed", {
      errorMessage: message,
      completedAt: new Date(),
    });

    return { runId, status: "failed", errorMessage: message };
  }
}
