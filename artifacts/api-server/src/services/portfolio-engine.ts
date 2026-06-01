/**
 * Portfolio backtesting engine — Phase 4.
 *
 * Runs a single strategy across multiple symbols simultaneously.
 * Capital is allocated equally across all symbols at start.
 * Each symbol is backtested independently (no cross-symbol position limits).
 * The portfolio equity curve is the sum of all per-symbol equity curves.
 *
 * Research-only. No live execution. No real capital.
 */

import { queryCandles } from "./market-data";
import { runBacktest } from "./backtesting-engine";
import { calculateMetrics } from "./performance-calculator";
import {
  createPortfolioBacktest,
  updatePortfolioBacktestStatus,
} from "./phase4-db";
import { saveEquityCurve } from "./equity-curve-service";
import { createStrategy, resolveParams } from "../strategies/registry";
import type { OhlcvCandle, EquityCurvePoint, StrategyParams } from "../strategies/types";
import type { CostModelConfig } from "./cost-model";
import type { PositionSizingConfig } from "./position-sizer";
import type { ComputedMetrics } from "./performance-calculator";
import { logger } from "../lib/logger";

export interface PortfolioBacktestRequest {
  name?: string;
  strategyName: string;
  symbols: string[];
  interval: string;
  startDate: Date;
  endDate: Date;
  params?: Partial<StrategyParams>;
  initialCapital?: number;
  costModel?: CostModelConfig;
  positionSizing?: PositionSizingConfig;
}

export interface SymbolResult {
  symbol: string;
  metrics: ComputedMetrics;
  tradeCount: number;
  finalEquity: number;
}

export interface PortfolioMetrics {
  totalReturnPct: number;
  annualizedReturnPct: number | null;
  maxDrawdownPct: number;
  sharpeRatio: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  ulcerIndex: number | null;
  exposureTimePct: number | null;
  totalTrades: number;
  winRate: number;
  profitFactor: number | null;
  symbolResults: SymbolResult[];
  initialCapital: number;
  finalEquity: number;
  totalCommission: number;
  totalSlippage: number;
}

export interface PortfolioBacktestJobResult {
  portfolioRunId: string;
  status: "completed" | "failed";
  errorMessage?: string;
}

/**
 * Merge multiple equity curves by timestamp alignment.
 * Adds up the equity from each symbol at each time step.
 * Uses the last known equity for a symbol if a timestamp is missing.
 */
function mergeEquityCurves(
  curves: EquityCurvePoint[][],
  capitalPerSymbol: number,
): EquityCurvePoint[] {
  if (curves.length === 0) return [];

  // Collect all unique timestamps
  const allTimestamps = new Set<number>();
  for (const curve of curves) {
    for (const pt of curve) {
      allTimestamps.add(pt.timestamp.getTime());
    }
  }

  const sortedTimestamps = Array.from(allTimestamps).sort((a, b) => a - b);

  // For each curve, build a map for O(1) lookup
  const curveMaps: Map<number, number>[] = curves.map((curve) => {
    const map = new Map<number, number>();
    for (const pt of curve) {
      map.set(pt.timestamp.getTime(), pt.equity);
    }
    return map;
  });

  const merged: EquityCurvePoint[] = [];
  const lastEquity = curves.map(() => capitalPerSymbol);

  for (const ts of sortedTimestamps) {
    let totalEquity = 0;
    for (let i = 0; i < curves.length; i++) {
      const eq = curveMaps[i]!.get(ts);
      if (eq !== undefined) lastEquity[i] = eq;
      totalEquity += lastEquity[i]!;
    }
    merged.push({ timestamp: new Date(ts), equity: totalEquity });
  }

  return merged;
}

export async function executePortfolioBacktest(
  request: PortfolioBacktestRequest,
): Promise<PortfolioBacktestJobResult> {
  const {
    name,
    strategyName,
    symbols,
    interval,
    startDate,
    endDate,
    params = {},
    initialCapital = 10_000,
    costModel,
    positionSizing,
  } = request;

  if (symbols.length === 0) {
    throw new Error("Portfolio backtest requires at least one symbol");
  }

  const strategy = createStrategy(strategyName);
  const resolvedParams = resolveParams(strategy, params);

  const portfolioRun = await createPortfolioBacktest({
    name: name ?? null,
    strategyName,
    symbols: JSON.stringify(symbols.map((s) => s.toUpperCase())),
    interval,
    startDate,
    endDate,
    parameters: JSON.stringify(resolvedParams),
    initialCapital: String(initialCapital),
    costModelId: null,
    positionSizingProfileId: null,
    completedAt: null,
    errorMessage: null,
    portfolioMetrics: null,
  });

  const portfolioRunId = portfolioRun.id;
  logger.info(
    { portfolioRunId, strategyName, symbols, interval },
    "Starting portfolio backtest",
  );

  try {
    await updatePortfolioBacktestStatus(portfolioRunId, "running");

    const capitalPerSymbol = initialCapital / symbols.length;
    const symbolResults: SymbolResult[] = [];
    const allEquityCurves: EquityCurvePoint[][] = [];
    let totalCandlesProcessed = 0;
    let totalCommission = 0;
    let totalSlippage = 0;

    for (const symbol of symbols) {
      const upperSymbol = symbol.toUpperCase();

      const rawCandles = await queryCandles({
        symbol: upperSymbol,
        interval,
        startTime: startDate,
        endTime: endDate,
        limit: 10_000,
      });

      if (rawCandles.length === 0) {
        logger.warn({ symbol: upperSymbol }, "No candles found for portfolio symbol — skipping");
        continue;
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

      // Create a fresh strategy instance per symbol
      const sym_strategy = createStrategy(strategyName);

      const { trades, equityCurve, candlesProcessed, totalCommission: symCommission, totalSlippage: symSlippage } =
        await runBacktest(
          { candles, strategy: sym_strategy, params: resolvedParams, initialCapital: capitalPerSymbol },
          { costModel, positionSizing },
        );

      const metrics = calculateMetrics(trades, equityCurve, capitalPerSymbol, symCommission, symSlippage);
      const finalEquity =
        equityCurve.length > 0
          ? equityCurve[equityCurve.length - 1]!.equity
          : capitalPerSymbol;

      symbolResults.push({
        symbol: upperSymbol,
        metrics,
        tradeCount: trades.length,
        finalEquity,
      });

      allEquityCurves.push(equityCurve);
      totalCandlesProcessed += candlesProcessed;
      totalCommission += symCommission;
      totalSlippage += symSlippage;
    }

    // -----------------------------------------------------------------------
    // Portfolio-level equity curve = sum of per-symbol curves
    // -----------------------------------------------------------------------
    const portfolioEquityCurve = mergeEquityCurves(allEquityCurves, capitalPerSymbol);

    // -----------------------------------------------------------------------
    // Portfolio-level metrics
    // -----------------------------------------------------------------------
    const finalEquity = portfolioEquityCurve.length > 0
      ? portfolioEquityCurve[portfolioEquityCurve.length - 1]!.equity
      : initialCapital;

    const totalReturnPct = (finalEquity - initialCapital) / initialCapital;

    let annualizedReturnPct: number | null = null;
    if (portfolioEquityCurve.length >= 2) {
      const startMs = portfolioEquityCurve[0]!.timestamp.getTime();
      const endMs = portfolioEquityCurve[portfolioEquityCurve.length - 1]!.timestamp.getTime();
      const daysElapsed = (endMs - startMs) / (1000 * 60 * 60 * 24);
      if (daysElapsed >= 1) {
        annualizedReturnPct = Math.pow(1 + totalReturnPct, 365.25 / daysElapsed) - 1;
      }
    }

    let maxDrawdownPct = 0;
    let peak = -Infinity;
    for (const pt of portfolioEquityCurve) {
      if (pt.equity > peak) peak = pt.equity;
      const dd = peak > 0 ? (peak - pt.equity) / peak : 0;
      if (dd > maxDrawdownPct) maxDrawdownPct = dd;
    }

    const totalTrades = symbolResults.reduce((a, s) => a + s.tradeCount, 0);
    const avgWinRate =
      symbolResults.length > 0
        ? symbolResults.reduce((a, s) => a + s.metrics.winRate, 0) / symbolResults.length
        : 0;

    const calmarRatio =
      annualizedReturnPct !== null && maxDrawdownPct > 0
        ? annualizedReturnPct / maxDrawdownPct
        : null;

    const portfolioMetrics: PortfolioMetrics = {
      totalReturnPct,
      annualizedReturnPct,
      maxDrawdownPct,
      sharpeRatio: symbolResults.length > 0
        ? symbolResults.reduce((a, s) => a + (s.metrics.sharpeRatio ?? 0), 0) / symbolResults.length
        : null,
      sortinoRatio: symbolResults.length > 0
        ? symbolResults.reduce((a, s) => a + (s.metrics.sortinoRatio ?? 0), 0) / symbolResults.length
        : null,
      calmarRatio,
      ulcerIndex: null,
      exposureTimePct: symbolResults.length > 0
        ? symbolResults.reduce((a, s) => a + (s.metrics.exposureTimePct ?? 0), 0) / symbolResults.length
        : null,
      totalTrades,
      winRate: avgWinRate,
      profitFactor: symbolResults.length > 0
        ? symbolResults.reduce((a, s) => a + (s.metrics.profitFactor ?? 1), 0) / symbolResults.length
        : null,
      symbolResults,
      initialCapital,
      finalEquity,
      totalCommission,
      totalSlippage,
    };

    // Save equity curve
    await saveEquityCurve(
      { portfolioBacktestId: portfolioRunId },
      portfolioEquityCurve,
      initialCapital,
    );

    await updatePortfolioBacktestStatus(portfolioRunId, "completed", {
      candlesProcessed: totalCandlesProcessed,
      completedAt: new Date(),
      portfolioMetrics: JSON.stringify(portfolioMetrics),
    });

    logger.info(
      {
        portfolioRunId,
        totalTrades,
        totalReturnPct,
        symbolCount: symbolResults.length,
      },
      "Portfolio backtest completed",
    );

    return { portfolioRunId, status: "completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ portfolioRunId, err }, "Portfolio backtest failed");
    await updatePortfolioBacktestStatus(portfolioRunId, "failed", {
      errorMessage: message,
      completedAt: new Date(),
    });
    return { portfolioRunId, status: "failed", errorMessage: message };
  }
}
