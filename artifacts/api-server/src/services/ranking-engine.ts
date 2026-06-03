/**
 * ranking-engine.ts — Phase 11 Multi-Factor Strategy Ranking Engine.
 *
 * Ranks all strategies that have completed backtests using a weighted
 * composite of 8 factors:
 *
 *   Sharpe (25%) | Sortino (15%) | Calmar (15%) | Max Drawdown (10%)
 *   Win Rate (10%) | Consistency (10%) | Walk-Forward (10%) | Monte Carlo (5%)
 *
 * Scores are normalized 0–100 within the universe of strategies being ranked.
 * Ranking periods: daily | weekly | monthly | all_time
 *
 * Advisory only — rankings inform allocation decisions but cannot initiate
 * any trade, order, or position change.
 */

import { db } from "@workspace/db";
import {
  backtestRunsTable,
  performanceMetricsTable,
  walkForwardRunsTable,
  monteCarloRunsTable,
} from "@workspace/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { insertStrategyRankingsBatch, listStrategyRankings, getLatestRankingsForPeriod } from "./intelligence-db";
import type {
  RankingPeriod,
  RankingFactors,
  StrategyRankingResult,
  RANKING_WEIGHTS,
} from "./intelligence-types";
import { RANKING_WEIGHTS as WEIGHTS } from "./intelligence-types";

// ---------------------------------------------------------------------------
// Data Aggregation
// ---------------------------------------------------------------------------

interface RawMetrics {
  strategyName: string;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  totalReturn: number;
  winRate: number;
  tradeCount: number;
  profitFactor: number;
  walkForwardScore: number | null;
  monteCarloScore: number | null;
}

/** Fetch the best-run metrics per strategy from backtest performance records */
async function gatherStrategyMetrics(period: RankingPeriod): Promise<RawMetrics[]> {
  const periodFilter: Record<RankingPeriod, number> = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    all_time: 36500,
  };

  const since = new Date(Date.now() - periodFilter[period] * 24 * 60 * 60 * 1000);

  // Get best performance metrics per strategy
  const perfRows = await db
    .select({
      strategyName: backtestRunsTable.strategyName,
      sharpeRatio: sql<string>`max(cast(${performanceMetricsTable.sharpeRatio} as float))`,
      sortinoRatio: sql<string>`avg(cast(${performanceMetricsTable.sortinoRatio} as float))`,
      totalReturn: sql<string>`max(cast(${performanceMetricsTable.totalReturnPct} as float))`,
      maxDrawdown: sql<string>`avg(cast(${performanceMetricsTable.maxDrawdownPct} as float))`,
      winRate: sql<string>`avg(cast(${performanceMetricsTable.winRate} as float))`,
      tradeCount: sql<string>`avg(${performanceMetricsTable.totalTrades})`,
      profitFactor: sql<string>`avg(cast(${performanceMetricsTable.profitFactor} as float))`,
    })
    .from(performanceMetricsTable)
    .innerJoin(backtestRunsTable, eq(performanceMetricsTable.backtestRunId, backtestRunsTable.id))
    .where(
      and(
        eq(backtestRunsTable.status, "completed"),
        sql`${backtestRunsTable.createdAt} >= ${since}`,
      ),
    )
    .groupBy(backtestRunsTable.strategyName);

  if (perfRows.length === 0) return [];

  const strategyNames = perfRows.map((r) => r.strategyName);

  // Walk-forward scores — join directly on strategyName (no backtestRunId FK)
  const wfRows = await db
    .select({
      strategyName: walkForwardRunsTable.strategyName,
      avgEfficiency: sql<string>`avg(cast(${walkForwardRunsTable.consistencyScore} as float))`,
    })
    .from(walkForwardRunsTable)
    .where(
      and(
        inArray(walkForwardRunsTable.strategyName, strategyNames),
        eq(walkForwardRunsTable.status, "completed"),
      ),
    )
    .groupBy(walkForwardRunsTable.strategyName);

  const wfMap = new Map(wfRows.map((r) => [r.strategyName, parseFloat(r.avgEfficiency ?? "0")]));

  // Monte Carlo scores: median_return is already a decimal fraction (0.15 = 15%)
  const mcRows = await db
    .select({
      strategyName: backtestRunsTable.strategyName,
      avgMedianReturn: sql<string>`avg(cast(${monteCarloRunsTable.medianReturn} as float))`,
    })
    .from(monteCarloRunsTable)
    .innerJoin(backtestRunsTable, eq(monteCarloRunsTable.backtestRunId, backtestRunsTable.id))
    .where(
      and(
        inArray(backtestRunsTable.strategyName, strategyNames),
        eq(monteCarloRunsTable.status, "completed"),
      ),
    )
    .groupBy(backtestRunsTable.strategyName);

  const mcMap = new Map(
    mcRows.map((r) => [
      r.strategyName,
      parseFloat(r.avgMedianReturn ?? "0") * 100,
    ]),
  );

  return perfRows.map((r) => ({
    strategyName: r.strategyName,
    sharpeRatio: parseFloat(r.sharpeRatio ?? "0"),
    sortinoRatio: parseFloat(r.sortinoRatio ?? "0"),
    calmarRatio: parseFloat(r.totalReturn ?? "0") / Math.max(0.01, Math.abs(parseFloat(r.maxDrawdown ?? "1"))),
    maxDrawdown: parseFloat(r.maxDrawdown ?? "0"),
    totalReturn: parseFloat(r.totalReturn ?? "0"),
    winRate: parseFloat(r.winRate ?? "0"),
    tradeCount: parseFloat(r.tradeCount ?? "0"),
    profitFactor: parseFloat(r.profitFactor ?? "1"),
    walkForwardScore: wfMap.get(r.strategyName) ?? null,
    monteCarloScore: mcMap.get(r.strategyName) ?? null,
  }));
}

// ---------------------------------------------------------------------------
// Score Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize an array of raw values to 0–100 (higher raw = higher score).
 * For drawdown (where higher raw = worse), pass invert=true.
 */
function normalize(values: number[], invert = false): number[] {
  const valid = values.filter((v) => isFinite(v) && !isNaN(v));
  if (valid.length === 0) return values.map(() => 50);
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  if (max === min) return values.map(() => 50);
  return values.map((v) => {
    if (!isFinite(v) || isNaN(v)) return 50;
    const raw = ((v - min) / (max - min)) * 100;
    return invert ? 100 - raw : raw;
  });
}

/** Estimate consistency score from Sharpe and win rate */
function consistencyScore(sharpe: number, winRate: number): number {
  return Math.min(100, Math.max(0, (sharpe * 10 + winRate * 100) / 2));
}

// ---------------------------------------------------------------------------
// Core Ranking
// ---------------------------------------------------------------------------

export async function computeRankings(period: RankingPeriod): Promise<StrategyRankingResult[]> {
  const metrics = await gatherStrategyMetrics(period);
  if (metrics.length === 0) {
    logger.info({ period }, "No strategies to rank");
    return [];
  }

  const n = metrics.length;

  // Extract arrays for normalization
  const sharpes = metrics.map((m) => m.sharpeRatio);
  const sortinos = metrics.map((m) => m.sortinoRatio);
  const calmars = metrics.map((m) => m.calmarRatio);
  const drawdowns = metrics.map((m) => Math.abs(m.maxDrawdown)); // invert
  const winRates = metrics.map((m) => m.winRate * 100);
  const consistencies = metrics.map((m) => consistencyScore(m.sharpeRatio, m.winRate));
  const wfScores = metrics.map((m) => m.walkForwardScore ?? sharpes[metrics.indexOf(m)] * 50);
  const mcScores = metrics.map((m) => m.monteCarloScore ?? winRates[metrics.indexOf(m)]);

  const normSharpe = normalize(sharpes);
  const normSortino = normalize(sortinos);
  const normCalmar = normalize(calmars);
  const normDrawdown = normalize(drawdowns, true); // invert: lower DD = better score
  const normWinRate = normalize(winRates);
  const normConsistency = normalize(consistencies);
  const normWF = normalize(wfScores);
  const normMC = normalize(mcScores);

  const results: StrategyRankingResult[] = metrics.map((m, i) => {
    const factors: RankingFactors = {
      sharpeScore: parseFloat(normSharpe[i].toFixed(2)),
      sortinoScore: parseFloat(normSortino[i].toFixed(2)),
      calmarScore: parseFloat(normCalmar[i].toFixed(2)),
      maxDrawdownScore: parseFloat(normDrawdown[i].toFixed(2)),
      winRateScore: parseFloat(normWinRate[i].toFixed(2)),
      consistencyScore: parseFloat(normConsistency[i].toFixed(2)),
      walkForwardScore: parseFloat(normWF[i].toFixed(2)),
      monteCarloScore: parseFloat(normMC[i].toFixed(2)),
    };

    const composite =
      factors.sharpeScore * WEIGHTS.sharpeScore +
      factors.sortinoScore * WEIGHTS.sortinoScore +
      factors.calmarScore * WEIGHTS.calmarScore +
      factors.maxDrawdownScore * WEIGHTS.maxDrawdownScore +
      factors.winRateScore * WEIGHTS.winRateScore +
      factors.consistencyScore * WEIGHTS.consistencyScore +
      factors.walkForwardScore * WEIGHTS.walkForwardScore +
      factors.monteCarloScore * WEIGHTS.monteCarloScore;

    return {
      strategyName: m.strategyName,
      compositeScore: parseFloat(composite.toFixed(4)),
      rankPosition: 0, // set after sort
      totalStrategies: n,
      percentile: 0, // set after sort
      factors,
      rawMetrics: {
        sharpeRatio: m.sharpeRatio,
        sortinoRatio: m.sortinoRatio,
        calmarRatio: m.calmarRatio,
        maxDrawdown: m.maxDrawdown,
        totalReturn: m.totalReturn,
        winRate: m.winRate,
        tradeCount: m.tradeCount,
      },
    };
  });

  // Sort descending by composite score
  results.sort((a, b) => b.compositeScore - a.compositeScore);

  // Assign rank positions and percentiles
  results.forEach((r, i) => {
    r.rankPosition = i + 1;
    r.percentile = parseFloat((((n - i) / n) * 100).toFixed(2));
  });

  return results;
}

/**
 * Compute rankings for a period and persist to DB.
 */
export async function computeAndPersistRankings(period: RankingPeriod) {
  logger.info({ period }, "Computing strategy rankings");
  const rankings = await computeRankings(period);
  if (rankings.length === 0) return { period, count: 0 };

  const now = new Date();
  const rows = rankings.map((r) => ({
    strategyName: r.strategyName,
    rankingPeriod: period,
    sharpeScore: r.factors.sharpeScore.toString(),
    sortinoScore: r.factors.sortinoScore.toString(),
    calmarScore: r.factors.calmarScore.toString(),
    maxDrawdownScore: r.factors.maxDrawdownScore.toString(),
    winRateScore: r.factors.winRateScore.toString(),
    consistencyScore: r.factors.consistencyScore.toString(),
    walkForwardScore: r.factors.walkForwardScore.toString(),
    monteCarloScore: r.factors.monteCarloScore.toString(),
    sharpeRatio: r.rawMetrics.sharpeRatio.toString(),
    sortinoRatio: r.rawMetrics.sortinoRatio.toString(),
    calmarRatio: r.rawMetrics.calmarRatio.toString(),
    maxDrawdown: r.rawMetrics.maxDrawdown.toString(),
    totalReturn: r.rawMetrics.totalReturn.toString(),
    winRate: r.rawMetrics.winRate.toString(),
    tradeCount: r.rawMetrics.tradeCount,
    compositeScore: r.compositeScore.toString(),
    rankPosition: r.rankPosition,
    totalStrategies: r.totalStrategies,
    percentile: r.percentile.toString(),
    computedAt: now,
  }));

  await insertStrategyRankingsBatch(rows);
  logger.info({ period, count: rows.length }, "Rankings persisted");
  return { period, count: rows.length };
}

/**
 * Run rankings for all periods.
 */
export async function runAllRankings() {
  const periods: RankingPeriod[] = ["daily", "weekly", "monthly", "all_time"];
  const results = await Promise.allSettled(periods.map((p) => computeAndPersistRankings(p)));
  const summary = { succeeded: 0, failed: 0 };
  for (const r of results) {
    if (r.status === "fulfilled") summary.succeeded++;
    else summary.failed++;
  }
  return summary;
}

export { listStrategyRankings, getLatestRankingsForPeriod };
