/**
 * research-coordinator.ts — Phase 11 Research Coordinator.
 *
 * Orchestrates the autonomous research pipeline:
 *
 *   1. Discover strategies needing analysis (new runs, no recent rankings)
 *   2. Dispatch AI research jobs for each strategy
 *   3. Execute pending jobs in priority order
 *   4. Trigger regime detection sweeps
 *   5. Trigger periodic ranking and clustering updates
 *   6. Submit optimization campaigns for poorly-ranked strategies
 *
 * Runs on a polling loop managed by the intelligence-scheduler.
 * Advisory only — cannot initiate trades or positions.
 */

import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { backtestRunsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { dispatchResearchJob, executeResearchJob } from "./ai-optimization-assistant";
import { runAllRankings } from "./ranking-engine";
import { computeAndPersistClusters } from "./intelligence-correlation-engine";
import { runRegimeDetectionForSymbols } from "./regime-detection-engine";
import { getPendingResearchJobs } from "./intelligence-db";
import { startOptimizationRun } from "./strategy-optimizer";


// ---------------------------------------------------------------------------
// Strategy Discovery
// ---------------------------------------------------------------------------

async function getStrategiesNeedingAnalysis(): Promise<string[]> {
  // Strategies with completed backtests but no recent AI analysis
  const rows = await db
    .select({ strategyName: backtestRunsTable.strategyName })
    .from(backtestRunsTable)
    .where(eq(backtestRunsTable.status, "completed"))
    .groupBy(backtestRunsTable.strategyName)
    .orderBy(desc(sql`max(${backtestRunsTable.createdAt})`))
    .limit(10);

  return rows.map((r) => r.strategyName);
}

async function getKnownSymbols(): Promise<string[]> {
  const rows = await db
    .select({ symbol: backtestRunsTable.symbol })
    .from(backtestRunsTable)
    .where(eq(backtestRunsTable.status, "completed"))
    .groupBy(backtestRunsTable.symbol)
    .limit(20);

  return rows.map((r) => r.symbol).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Research Coordination Cycle
// ---------------------------------------------------------------------------

export async function runCoordinationCycle(): Promise<{
  jobsDispatched: number;
  jobsExecuted: number;
  regimesUpdated: number;
  rankingsUpdated: boolean;
  clustersUpdated: boolean;
}> {
  logger.info("Starting research coordination cycle");
  const result = {
    jobsDispatched: 0,
    jobsExecuted: 0,
    regimesUpdated: 0,
    rankingsUpdated: false,
    clustersUpdated: false,
  };

  try {
    // 1. Discover strategies and dispatch analysis jobs
    const strategies = await getStrategiesNeedingAnalysis();
    for (const strategyName of strategies) {
      await dispatchResearchJob("strategy_analysis", strategyName, {}, "low");
      result.jobsDispatched++;
    }

    // 2. Execute pending jobs (up to 5 per cycle)
    const pendingJobs = await getPendingResearchJobs(5);
    for (const job of pendingJobs) {
      try {
        await executeResearchJob(job.id);
        result.jobsExecuted++;
      } catch (err) {
        logger.warn({ err, jobId: job.id }, "Job execution failed in coordination cycle");
      }
    }

    // 3. Regime detection
    const symbols = await getKnownSymbols();
    if (symbols.length > 0) {
      const regimeSummary = await runRegimeDetectionForSymbols(symbols);
      result.regimesUpdated = regimeSummary.detected;
    }
  } catch (err) {
    logger.error({ err }, "Error in research coordination cycle");
  }

  logger.info(result, "Coordination cycle complete");
  return result;
}

/**
 * Run a full intelligence refresh:
 * rankings + clusters + regime detection.
 * Called less frequently than the coordination cycle.
 */
export async function runFullIntelligenceRefresh(): Promise<{
  rankings: Record<string, number>;
  clusters: { method: string; count: number }[];
  regimes: { detected: number; failed: number };
}> {
  logger.info("Running full intelligence refresh");

  const [rankingsResult, correlationResult, regimeResult, symbols] = await Promise.allSettled([
    runAllRankings(),
    computeAndPersistClusters("correlation"),
    Promise.resolve({ detected: 0, failed: 0 }),
    getKnownSymbols(),
  ]);

  // Regime detection with known symbols
  const syms = symbols.status === "fulfilled" ? symbols.value : [];
  const regimes = syms.length > 0
    ? await runRegimeDetectionForSymbols(syms)
    : { detected: 0, failed: 0, symbols: [] };

  return {
    rankings:
      rankingsResult.status === "fulfilled"
        ? (rankingsResult.value as Record<string, number>)
        : {},
    clusters:
      correlationResult.status === "fulfilled"
        ? [correlationResult.value]
        : [],
    regimes: { detected: regimes.detected, failed: regimes.failed },
  };
}

/**
 * Trigger an optimization run for a poorly-ranked strategy.
 */
export async function triggerOptimizationForStrategy(
  strategyName: string,
  symbol: string,
  parameterSpace: Record<string, { min: number; max: number; step?: number; type?: "int" | "float" }>,
  method: "random_search" | "bayesian" | "genetic" = "random_search",
): Promise<string> {
  logger.info({ strategyName, method }, "Triggering automated optimization");

  const runId = await startOptimizationRun({
    strategyName,
    method,
    objective: "sharpe",
    parameterSpace,
    symbol,
    timeframe: "1d",
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    maxIterations: 50,
  });

  // Dispatch an AI job to analyze the optimization results once complete
  await dispatchResearchJob(
    "optimization_recommendation",
    strategyName,
    { optimizationRunId: runId, method },
    "medium",
    new Date(Date.now() + 2 * 60 * 1000), // Schedule 2 minutes out
  );

  return runId;
}
