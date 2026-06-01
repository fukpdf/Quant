/**
 * Walk-forward validation runner — Phase 4.
 *
 * Splits the full historical window into sequential in-sample (IS) /
 * out-of-sample (OOS) sub-periods, runs the strategy on each, and
 * measures how well IS performance predicts OOS performance.
 *
 * Research-only. No live execution.
 */

import { queryCandles } from "./market-data";
import { runBacktest } from "./backtesting-engine";
import { calculateMetrics } from "./performance-calculator";
import { createWalkForwardRun, updateWalkForwardRun } from "./phase4-db";
import { createStrategy, resolveParams } from "../strategies/registry";
import type { OhlcvCandle, StrategyParams } from "../strategies/types";
import type { CostModelConfig } from "./cost-model";
import type { PositionSizingConfig } from "./position-sizer";
import { logger } from "../lib/logger";

export interface WalkForwardRequest {
  strategyName: string;
  symbol: string;
  interval: string;
  startDate: Date;
  endDate: Date;
  params?: Partial<StrategyParams>;
  initialCapital?: number;
  /** Fraction of each window for in-sample training (0 < x < 1) */
  inSamplePct?: number;
  /** Number of windows to create across the full date range */
  windowCount?: number;
  /** rolling: fixed-length windows; expanding: start fixed, end grows */
  windowType?: "rolling" | "expanding";
  costModel?: CostModelConfig;
  positionSizing?: PositionSizingConfig;
}

export interface WalkForwardWindowResult {
  windowIndex: number;
  isStart: string;
  isEnd: string;
  oosStart: string;
  oosEnd: string;
  isTotalReturnPct: number;
  oosTotalReturnPct: number;
  isSharpe: number | null;
  oosSharpe: number | null;
  isTrades: number;
  oosTrades: number;
}

export interface WalkForwardJobResult {
  walkForwardRunId: string;
  status: "completed" | "failed";
  errorMessage?: string;
}

function splitWindows(
  candles: OhlcvCandle[],
  windowCount: number,
  inSamplePct: number,
  windowType: "rolling" | "expanding",
): Array<{ isCandles: OhlcvCandle[]; oosCandles: OhlcvCandle[] }> {
  if (candles.length < 10 || windowCount < 1) return [];

  const windows: Array<{ isCandles: OhlcvCandle[]; oosCandles: OhlcvCandle[] }> = [];
  const windowSize = Math.floor(candles.length / windowCount);
  const isSize = Math.floor(windowSize * inSamplePct);
  const oosSize = windowSize - isSize;

  if (isSize < 3 || oosSize < 2) return [];

  for (let w = 0; w < windowCount; w++) {
    let isStart: number;
    let isEnd: number;

    if (windowType === "expanding") {
      isStart = 0;
      isEnd = isSize + w * oosSize;
    } else {
      isStart = w * windowSize;
      isEnd = isStart + isSize;
    }

    const oosStart = isEnd;
    const oosEnd = oosStart + oosSize;

    if (oosEnd > candles.length) break;

    windows.push({
      isCandles: candles.slice(isStart, isEnd),
      oosCandles: candles.slice(oosStart, oosEnd),
    });
  }

  return windows;
}

export async function executeWalkForward(
  request: WalkForwardRequest,
): Promise<WalkForwardJobResult> {
  const {
    strategyName,
    symbol,
    interval,
    startDate,
    endDate,
    params = {},
    initialCapital = 10_000,
    inSamplePct = 0.7,
    windowCount = 5,
    windowType = "rolling",
    costModel,
    positionSizing,
  } = request;

  const strategy = createStrategy(strategyName);
  const resolvedParams = resolveParams(strategy, params);

  const wfRun = await createWalkForwardRun({
    strategyName,
    symbol: symbol.toUpperCase(),
    interval,
    fullStartDate: startDate,
    fullEndDate: endDate,
    parameters: JSON.stringify(resolvedParams),
    initialCapital: String(initialCapital),
    inSamplePct: String(inSamplePct),
    windowCount,
    windowType,
    windowResults: null,
    avgOosReturnPct: null,
    avgIsReturnPct: null,
    consistencyScore: null,
    passedValidation: null,
    completedAt: null,
    errorMessage: null,
  });

  const wfId = wfRun.id;
  logger.info({ wfId, strategyName, symbol, windowCount, windowType }, "Starting walk-forward run");

  try {
    await updateWalkForwardRun(wfId, { status: "running" });

    const rawCandles = await queryCandles({
      symbol: symbol.toUpperCase(),
      interval,
      startTime: startDate,
      endTime: endDate,
      limit: 10_000,
    });

    if (rawCandles.length < 20) {
      throw new Error(
        `Insufficient candle data for walk-forward: ${rawCandles.length} candles`,
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

    const windows = splitWindows(candles, windowCount, inSamplePct, windowType);

    if (windows.length === 0) {
      throw new Error("No valid walk-forward windows could be constructed");
    }

    const windowResults: WalkForwardWindowResult[] = [];

    for (let wIdx = 0; wIdx < windows.length; wIdx++) {
      const { isCandles, oosCandles } = windows[wIdx]!;

      const isStrategy = createStrategy(strategyName);
      const oosStrategy = createStrategy(strategyName);

      const [isResult, oosResult] = await Promise.all([
        runBacktest(
          { candles: isCandles, strategy: isStrategy, params: resolvedParams, initialCapital },
          { costModel, positionSizing },
        ),
        runBacktest(
          { candles: oosCandles, strategy: oosStrategy, params: resolvedParams, initialCapital },
          { costModel, positionSizing },
        ),
      ]);

      const isMetrics = calculateMetrics(
        isResult.trades, isResult.equityCurve, initialCapital,
        isResult.totalCommission, isResult.totalSlippage,
      );
      const oosMetrics = calculateMetrics(
        oosResult.trades, oosResult.equityCurve, initialCapital,
        oosResult.totalCommission, oosResult.totalSlippage,
      );

      windowResults.push({
        windowIndex: wIdx,
        isStart: isCandles[0]!.timestamp.toISOString(),
        isEnd: isCandles[isCandles.length - 1]!.timestamp.toISOString(),
        oosStart: oosCandles[0]!.timestamp.toISOString(),
        oosEnd: oosCandles[oosCandles.length - 1]!.timestamp.toISOString(),
        isTotalReturnPct: isMetrics.totalReturnPct,
        oosTotalReturnPct: oosMetrics.totalReturnPct,
        isSharpe: isMetrics.sharpeRatio,
        oosSharpe: oosMetrics.sharpeRatio,
        isTrades: isMetrics.totalTrades,
        oosTrades: oosMetrics.totalTrades,
      });
    }

    const avgIsReturnPct =
      windowResults.reduce((a, w) => a + w.isTotalReturnPct, 0) / windowResults.length;
    const avgOosReturnPct =
      windowResults.reduce((a, w) => a + w.oosTotalReturnPct, 0) / windowResults.length;

    // Consistency score: OOS/IS return ratio capped to [-2, 2]
    const consistencyScore =
      Math.abs(avgIsReturnPct) > 0.0001
        ? Math.max(-2, Math.min(2, avgOosReturnPct / Math.abs(avgIsReturnPct)))
        : 0;

    // Pass if >50% of windows have positive OOS return
    const positiveOosWindows = windowResults.filter((w) => w.oosTotalReturnPct > 0).length;
    const passedValidation = positiveOosWindows > windowResults.length / 2;

    await updateWalkForwardRun(wfId, {
      status: "completed",
      windowResults: JSON.stringify(windowResults),
      avgIsReturnPct: String(avgIsReturnPct),
      avgOosReturnPct: String(avgOosReturnPct),
      consistencyScore: String(consistencyScore),
      passedValidation,
      completedAt: new Date(),
    });

    logger.info(
      { wfId, windows: windowResults.length, avgOosReturnPct, consistencyScore, passedValidation },
      "Walk-forward run completed",
    );

    return { walkForwardRunId: wfId, status: "completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ wfId, err }, "Walk-forward run failed");
    await updateWalkForwardRun(wfId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
    });
    return { walkForwardRunId: wfId, status: "failed", errorMessage: message };
  }
}
