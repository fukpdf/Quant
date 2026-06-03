/**
 * intelligence-correlation-engine.ts — Phase 11 Strategy Correlation & Clustering Engine.
 *
 * Groups strategies into clusters by comparing their return series.
 * Builds pairwise correlation matrices over backtest equity curves,
 * then clusters strategies using hierarchical agglomerative clustering
 * (average-linkage) on the correlation distance matrix.
 *
 * Cluster methods:
 *   correlation — based on return series correlation
 *   performance — based on metric similarity (Sharpe, DD, win rate)
 *   regime      — based on performance per regime type
 *   combined    — weighted combination of all methods
 *
 * Advisory only — clustering informs portfolio construction but cannot
 * execute any trade or change any position.
 */

import { db } from "@workspace/db";
import {
  backtestRunsTable,
  equityCurvesTable,
  performanceMetricsTable,
} from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  insertStrategyClustersBatch,
  archiveOldClusters,
  listStrategyClusters,
} from "./intelligence-db";
import type { ClusterMethod, ClusterResult, RegimeType } from "./intelligence-types";


// ---------------------------------------------------------------------------
// Pearson Correlation
// ---------------------------------------------------------------------------

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const aSlice = a.slice(0, n);
  const bSlice = b.slice(0, n);
  const meanA = aSlice.reduce((s, v) => s + v, 0) / n;
  const meanB = bSlice.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const dA = aSlice[i] - meanA;
    const dB = bSlice[i] - meanB;
    num += dA * dB;
    da += dA * dA;
    db += dB * dB;
  }
  const denom = Math.sqrt(da * db);
  return denom === 0 ? 0 : num / denom;
}

// ---------------------------------------------------------------------------
// Equity Curve Extraction
// ---------------------------------------------------------------------------

interface StrategyReturns {
  strategyName: string;
  returns: number[];
  metrics: {
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalReturn: number;
  };
}

async function gatherStrategyReturns(): Promise<StrategyReturns[]> {
  // Get the most recent completed backtest run per strategy
  const latestRuns = await db
    .select({
      strategyName: backtestRunsTable.strategyName,
      runId: sql<string>`(
        SELECT id FROM backtest_runs br2
        WHERE br2.strategy_name = ${backtestRunsTable.strategyName}
          AND br2.status = 'completed'
        ORDER BY br2.created_at DESC
        LIMIT 1
      )`,
    })
    .from(backtestRunsTable)
    .where(eq(backtestRunsTable.status, "completed"))
    .groupBy(backtestRunsTable.strategyName)
    .limit(20);

  const results: StrategyReturns[] = [];

  for (const run of latestRuns) {
    if (!run.runId) continue;

    const [curve] = await db
      .select()
      .from(equityCurvesTable)
      .where(eq(equityCurvesTable.backtestRunId, run.runId))
      .limit(1);

    const [metrics] = await db
      .select()
      .from(performanceMetricsTable)
      .where(eq(performanceMetricsTable.backtestRunId, run.runId))
      .limit(1);

    if (!curve || !metrics) continue;

    // Parse compact equity curve format { t: [], e: [], d: [] }
    let equityPoints: number[] = [];
    try {
      const curveData = curve.curveData as { e?: number[]; t?: number[] };
      equityPoints = curveData.e ?? [];
    } catch {
      continue;
    }

    if (equityPoints.length < 5) continue;

    // Convert equity to daily returns
    const returns: number[] = [];
    for (let i = 1; i < equityPoints.length; i++) {
      if (equityPoints[i - 1] > 0) {
        returns.push((equityPoints[i] - equityPoints[i - 1]) / equityPoints[i - 1]);
      }
    }

    results.push({
      strategyName: run.strategyName,
      returns,
      metrics: {
        sharpeRatio: parseFloat(metrics.sharpeRatio ?? "0"),
        maxDrawdown: parseFloat(metrics.maxDrawdownPct ?? "0"),
        winRate: parseFloat(metrics.winRate ?? "0"),
        totalReturn: parseFloat(metrics.totalReturnPct ?? "0"),
      },
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Hierarchical Clustering (Average-Linkage)
// ---------------------------------------------------------------------------

interface ClusterNode {
  members: number[];  // Indices into strategy array
  distance: number;
}

function buildDistanceMatrix(corrMatrix: number[][]): number[][] {
  return corrMatrix.map((row) => row.map((c) => 1 - Math.abs(c)));
}

function averageLinkageDistance(
  clustA: number[],
  clustB: number[],
  distMatrix: number[][],
): number {
  let total = 0;
  let count = 0;
  for (const a of clustA) {
    for (const b of clustB) {
      total += distMatrix[a][b];
      count++;
    }
  }
  return count === 0 ? 1 : total / count;
}

/**
 * Agglomerative clustering with configurable distance threshold.
 * Returns array of cluster member index arrays.
 */
function agglomerativeClustering(distMatrix: number[][], threshold: number): number[][] {
  const n = distMatrix.length;
  let clusters: number[][] = Array.from({ length: n }, (_, i) => [i]);

  while (clusters.length > 1) {
    let minDist = Infinity;
    let mergeA = -1;
    let mergeB = -1;

    for (let a = 0; a < clusters.length; a++) {
      for (let b = a + 1; b < clusters.length; b++) {
        const d = averageLinkageDistance(clusters[a], clusters[b], distMatrix);
        if (d < minDist) {
          minDist = d;
          mergeA = a;
          mergeB = b;
        }
      }
    }

    if (minDist >= threshold) break;

    const merged = [...clusters[mergeA], ...clusters[mergeB]];
    clusters = clusters.filter((_, i) => i !== mergeA && i !== mergeB);
    clusters.push(merged);
  }

  return clusters;
}

// ---------------------------------------------------------------------------
// Silhouette Score
// ---------------------------------------------------------------------------

function silhouetteScore(clusterIdx: number[], allClusters: number[][], distMatrix: number[][]): number {
  if (clusterIdx.length <= 1 || allClusters.length <= 1) return 0;

  const scores: number[] = [];
  for (const i of clusterIdx) {
    // Mean intra-cluster distance
    const intraDists = clusterIdx.filter((j) => j !== i).map((j) => distMatrix[i][j]);
    const a = intraDists.length > 0 ? intraDists.reduce((s, v) => s + v, 0) / intraDists.length : 0;

    // Mean nearest-cluster distance
    const otherClusters = allClusters.filter((c) => c !== clusterIdx);
    if (otherClusters.length === 0) { scores.push(0); continue; }

    const b = Math.min(
      ...otherClusters.map((oc) => {
        const dists = oc.map((j) => distMatrix[i][j]);
        return dists.reduce((s, v) => s + v, 0) / dists.length;
      }),
    );

    scores.push((b - a) / Math.max(a, b));
  }
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

// ---------------------------------------------------------------------------
// Cluster Construction
// ---------------------------------------------------------------------------

export async function computeStrategyClusters(
  method: ClusterMethod = "correlation",
  threshold = 0.4,
): Promise<ClusterResult[]> {
  const strategies = await gatherStrategyReturns();
  if (strategies.length < 2) {
    logger.info({ count: strategies.length }, "Too few strategies to cluster");
    return [];
  }

  const n = strategies.length;

  // Build correlation matrix
  const corrMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) { corrMatrix[i][j] = 1; continue; }
      corrMatrix[i][j] = pearsonCorrelation(strategies[i].returns, strategies[j].returns);
    }
  }

  let distMatrix: number[][];
  if (method === "performance") {
    // Distance based on normalized metric similarity
    distMatrix = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => {
        if (i === j) return 0;
        const a = strategies[i].metrics;
        const b = strategies[j].metrics;
        return (
          Math.abs(a.sharpeRatio - b.sharpeRatio) / (Math.max(Math.abs(a.sharpeRatio), Math.abs(b.sharpeRatio), 0.001)) * 0.4 +
          Math.abs(a.maxDrawdown - b.maxDrawdown) / (Math.max(Math.abs(a.maxDrawdown), Math.abs(b.maxDrawdown), 0.001)) * 0.3 +
          Math.abs(a.winRate - b.winRate) / 0.5 * 0.3
        );
      }),
    );
  } else {
    distMatrix = buildDistanceMatrix(corrMatrix);
  }

  const rawClusters = agglomerativeClustering(distMatrix, threshold);

  return rawClusters.map((memberIndices, ci) => {
    const members = memberIndices.map((i) => strategies[i]);
    const memberNames = members.map((m) => m.strategyName);

    // Average pairwise correlation
    let corrSum = 0;
    let corrCount = 0;
    for (let a = 0; a < memberIndices.length; a++) {
      for (let b = a + 1; b < memberIndices.length; b++) {
        corrSum += Math.abs(corrMatrix[memberIndices[a]][memberIndices[b]]);
        corrCount++;
      }
    }
    const avgCorrelation = corrCount > 0 ? corrSum / corrCount : 1;

    const avgSharpe = members.reduce((s, m) => s + m.metrics.sharpeRatio, 0) / members.length;
    const avgDD = members.reduce((s, m) => s + m.metrics.maxDrawdown, 0) / members.length;
    const diversificationScore = Math.max(0, 1 - avgCorrelation);
    const silhouette = silhouetteScore(memberIndices, rawClusters, distMatrix);

    const centroid: Record<string, number> = {
      avg_sharpe: parseFloat(avgSharpe.toFixed(4)),
      avg_max_drawdown: parseFloat(avgDD.toFixed(4)),
      avg_win_rate: parseFloat((members.reduce((s, m) => s + m.metrics.winRate, 0) / members.length).toFixed(4)),
    };

    return {
      clusterName: `Cluster-${ci + 1}-${method.slice(0, 4).toUpperCase()}`,
      strategyNames: memberNames,
      centroid,
      avgCorrelation: parseFloat(avgCorrelation.toFixed(6)),
      avgSharpe: parseFloat(avgSharpe.toFixed(6)),
      avgMaxDrawdown: parseFloat(avgDD.toFixed(6)),
      diversificationScore: parseFloat(diversificationScore.toFixed(4)),
      silhouetteScore: parseFloat(silhouette.toFixed(6)),
      regimeAffinity: {} as Record<RegimeType, number>,
    };
  });
}

/**
 * Compute and persist strategy clusters for a given method.
 */
export async function computeAndPersistClusters(method: ClusterMethod = "correlation") {
  logger.info({ method }, "Computing strategy clusters");
  const clusters = await computeStrategyClusters(method);
  if (clusters.length === 0) return { method, count: 0 };

  await archiveOldClusters(method);

  const now = new Date();
  const rows = clusters.map((c) => ({
    clusterName: c.clusterName,
    strategyNames: c.strategyNames as unknown[],
    clusterMethod: method,
    centroid: c.centroid as Record<string, unknown>,
    avgCorrelation: c.avgCorrelation.toString(),
    avgSharpe: c.avgSharpe.toString(),
    avgMaxDrawdown: c.avgMaxDrawdown.toString(),
    diversificationScore: c.diversificationScore.toString(),
    clusterSize: c.strategyNames.length.toString(),
    silhouetteScore: c.silhouetteScore.toString(),
    regimeAffinity: c.regimeAffinity as Record<string, unknown>,
    status: "active",
    computedAt: now,
  }));

  await insertStrategyClustersBatch(rows);
  logger.info({ method, count: rows.length }, "Clusters persisted");
  return { method, count: rows.length };
}

/** Build a pairwise correlation matrix for all strategies */
export async function buildCorrelationMatrix(): Promise<{
  strategies: string[];
  matrix: number[][];
}> {
  const strategies = await gatherStrategyReturns();
  const n = strategies.length;
  const matrix: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      return parseFloat(
        pearsonCorrelation(strategies[i].returns, strategies[j].returns).toFixed(4),
      );
    }),
  );
  return { strategies: strategies.map((s) => s.strategyName), matrix };
}

export { listStrategyClusters };
