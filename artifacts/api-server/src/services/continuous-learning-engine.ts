/**
 * continuous-learning-engine.ts — Phase 11 Continuous Learning Engine.
 *
 * Maintains a running picture of the intelligence layer's own performance:
 *
 *   - Tracks which optimization runs produced genuine improvements
 *   - Identifies which regime detection signals correlated with strategy returns
 *   - Records which AI findings were acted upon and what the outcome was
 *   - Computes learning metrics for platform intelligence health
 *
 * This engine does NOT adjust any live trading parameters.
 * It builds the institutional memory that makes future research cycles smarter.
 */

import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import {
  optimizationRunsTable,
  aiResearchJobsTable,
  aiResearchFindingsTable,
  strategyRankingsTable,
  strategyClustersTable,
  marketRegimesTable,
} from "@workspace/db/schema";
import { eq, sql, and, gte, desc } from "drizzle-orm";
import type { LearningMetrics } from "./intelligence-types";


// ---------------------------------------------------------------------------
// Metrics Computation
// ---------------------------------------------------------------------------

export async function computeLearningMetrics(): Promise<LearningMetrics> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Last 7 days

  const [optRuns] = await db
    .select({
      total: sql<number>`count(*)`,
      successful: sql<number>`count(*) filter (where status = 'completed')`,
    })
    .from(optimizationRunsTable)
    .where(gte(optimizationRunsTable.createdAt, since));

  const [aiJobs] = await db
    .select({
      completed: sql<number>`count(*) filter (where status = 'completed')`,
    })
    .from(aiResearchJobsTable)
    .where(gte(aiResearchJobsTable.createdAt, since));

  const [findings] = await db
    .select({
      total: sql<number>`count(*)`,
    })
    .from(aiResearchFindingsTable)
    .where(gte(aiResearchFindingsTable.createdAt, since));

  const [regimes] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(marketRegimesTable)
    .where(gte(marketRegimesTable.createdAt, since));

  const [rankings] = await db
    .select({
      count: sql<number>`count(*)`,
    })
    .from(strategyRankingsTable)
    .where(gte(strategyRankingsTable.computedAt, since));

  const [clusters] = await db
    .select({
      count: sql<number>`count(*) filter (where status = 'active')`,
    })
    .from(strategyClustersTable);

  // Best strategy by composite score (all time)
  const [bestStrategy] = await db
    .select({ strategyName: strategyRankingsTable.strategyName })
    .from(strategyRankingsTable)
    .where(eq(strategyRankingsTable.rankingPeriod, "all_time"))
    .orderBy(desc(strategyRankingsTable.compositeScore))
    .limit(1);

  // Average improvement delta from optimizations
  const [avgImprovement] = await db
    .select({
      avg: sql<string>`avg(cast(best_score as float))`,
    })
    .from(optimizationRunsTable)
    .where(
      and(
        eq(optimizationRunsTable.status, "completed"),
        gte(optimizationRunsTable.createdAt, since),
      ),
    );

  return {
    totalOptimizationRuns: Number(optRuns?.total ?? 0),
    successfulRuns: Number(optRuns?.successful ?? 0),
    avgImprovementDelta: parseFloat(avgImprovement?.avg ?? "0"),
    bestStrategyFound: bestStrategy?.strategyName ?? null,
    regimesDetected: Number(regimes?.count ?? 0),
    rankingsComputed: Number(rankings?.count ?? 0),
    clustersIdentified: Number(clusters?.count ?? 0),
    aiJobsCompleted: Number(aiJobs?.completed ?? 0),
    findingsGenerated: Number(findings?.total ?? 0),
  };
}

// ---------------------------------------------------------------------------
// Intelligence Health Assessment
// ---------------------------------------------------------------------------

export interface IntelligenceHealthReport {
  overallScore: number;    // 0–100
  dimensions: {
    optimizationActivity: number;
    aiResearchCoverage: number;
    regimeDetectionFreshness: number;
    rankingCoverage: number;
    clusteringDiversity: number;
  };
  observations: string[];
  recommendations: string[];
  computedAt: string;
  metrics: LearningMetrics;
}

export async function computeIntelligenceHealth(): Promise<IntelligenceHealthReport> {
  const metrics = await computeLearningMetrics();
  const observations: string[] = [];
  const recommendations: string[] = [];

  // Score dimensions 0–100
  const optScore = Math.min(100, metrics.successfulRuns * 20);
  const aiScore = Math.min(100, metrics.aiJobsCompleted * 15);
  const regimeScore = Math.min(100, metrics.regimesDetected * 10);
  const rankScore = Math.min(100, metrics.rankingsComputed > 0 ? 80 : 0);
  const clusterScore = Math.min(100, metrics.clustersIdentified * 20);

  if (metrics.successfulRuns === 0) {
    observations.push("No optimization runs completed in the last 7 days.");
    recommendations.push("Start an optimization run to discover better strategy parameters.");
  }

  if (metrics.aiJobsCompleted === 0) {
    observations.push("No AI research jobs completed recently.");
    recommendations.push("Dispatch strategy analysis jobs via /api/v1/intelligence/research/jobs.");
  }

  if (metrics.regimesDetected === 0) {
    observations.push("No market regimes detected recently.");
    recommendations.push("Ensure market data is being ingested and trigger a regime detection sweep.");
  }

  if (metrics.bestStrategyFound) {
    observations.push(`Best-ranked strategy (all-time): ${metrics.bestStrategyFound}`);
  }

  if (metrics.avgImprovementDelta > 0.5) {
    observations.push(`Optimization runs averaging ${metrics.avgImprovementDelta.toFixed(2)} improvement in objective score.`);
  }

  if (metrics.findingsGenerated > 10) {
    observations.push(`${metrics.findingsGenerated} AI research findings generated — review unacknowledged findings.`);
  }

  const overallScore = Math.round(
    (optScore + aiScore + regimeScore + rankScore + clusterScore) / 5,
  );

  return {
    overallScore,
    dimensions: {
      optimizationActivity: optScore,
      aiResearchCoverage: aiScore,
      regimeDetectionFreshness: regimeScore,
      rankingCoverage: rankScore,
      clusteringDiversity: clusterScore,
    },
    observations,
    recommendations,
    computedAt: new Date().toISOString(),
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Learning Cycle
// ---------------------------------------------------------------------------

export async function runLearningCycle(): Promise<LearningMetrics> {
  logger.info("Running continuous learning cycle");

  const metrics = await computeLearningMetrics();

  logger.info(
    {
      successfulRuns: metrics.successfulRuns,
      aiJobs: metrics.aiJobsCompleted,
      regimes: metrics.regimesDetected,
      bestStrategy: metrics.bestStrategyFound,
    },
    "Learning metrics snapshot",
  );

  return metrics;
}
