import { queryCandles } from "./market-data";
import { runBacktest } from "./backtesting-engine";
import { calculateMetrics } from "./performance-calculator";
import {
  createBacktestRun,
  updateBacktestRunStatus,
  saveBacktestTrades,
  savePerformanceMetrics,
} from "./research-db";
import { saveEquityCurve } from "./equity-curve-service";
import { createStrategy, resolveParams } from "../strategies/registry";
import type { OhlcvCandle, StrategyParams } from "../strategies/types";
import type { CostModelConfig } from "./cost-model";
import type { PositionSizingConfig } from "./position-sizer";
import { logger } from "../lib/logger";

export interface BacktestRequest {
  strategyName: string;
  symbol: string;
  interval: string;
  startDate: Date;
  endDate: Date;
  params?: Partial<StrategyParams>;
  initialCapital?: number;
  /** Optional Phase 4 cost model (defaults to zero cost) */
  costModel?: CostModelConfig;
  /** Optional Phase 4 position sizing (defaults to 100% fixed percentage) */
  positionSizing?: PositionSizingConfig;
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
 *  4. Run the backtest engine (with optional cost model + position sizing).
 *  5. Calculate performance metrics (Phase 3 + Phase 4 advanced).
 *  6. Persist trades, metrics, and equity curve.
 *  7. Update run status to completed or failed.
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
    costModel,
    positionSizing,
  } = request;

  const strategy = createStrategy(strategyName);
  const resolvedParams = resolveParams(strategy, params);

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

    const candles: OhlcvCandle[] = rawCandles
      .map((c) => ({
        timestamp: c.timestamp instanceof Date ? c.timestamp : new Date(c.timestamp),
        open: parseFloat(String(c.open)),
        high: parseFloat(String(c.high)),
        low: parseFloat(String(c.low)),
        close: parseFloat(String(c.close)),
        volume: parseFloat(String(c.volume)),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const {
      trades,
      equityCurve,
      candlesProcessed,
      totalCommission,
      totalSlippage,
    } = await runBacktest(
      { candles, strategy, params: resolvedParams, initialCapital },
      { costModel, positionSizing },
    );

    const metrics = calculateMetrics(
      trades,
      equityCurve,
      initialCapital,
      totalCommission,
      totalSlippage,
    );

    await saveBacktestTrades(runId, trades);
    await savePerformanceMetrics(runId, metrics);
    await saveEquityCurve({ backtestRunId: runId }, equityCurve, initialCapital);
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
        totalCommission: metrics.totalCommission,
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
