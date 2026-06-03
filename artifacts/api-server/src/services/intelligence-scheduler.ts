/**
 * intelligence-scheduler.ts — Phase 11 Intelligence Layer Startup & Scheduler.
 *
 * Manages the lifecycle of all Phase 11 intelligence services.
 * Non-fatal: if the intelligence layer fails to start, the API server
 * continues operating normally (all prior phases remain unaffected).
 *
 * Polling intervals:
 *   Regime detection:       every 60 minutes
 *   Rankings:               every 6 hours
 *   Clustering:             every 12 hours
 *   Research coordination:  every 30 minutes
 *   Learning cycle:         every 2 hours
 */

import { logger } from "../lib/logger";
import { runCoordinationCycle, runFullIntelligenceRefresh } from "./research-coordinator";
import { runLearningCycle } from "./continuous-learning-engine";
import { runRegimeDetectionForSymbols } from "./regime-detection-engine";
import { runAllRankings } from "./ranking-engine";
import { computeAndPersistClusters } from "./intelligence-correlation-engine";
import { db } from "@workspace/db";
import { backtestRunsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";


// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let regimeTimer: NodeJS.Timeout | null = null;
let rankingTimer: NodeJS.Timeout | null = null;
let clusteringTimer: NodeJS.Timeout | null = null;
let coordinationTimer: NodeJS.Timeout | null = null;
let learningTimer: NodeJS.Timeout | null = null;

let isStarted = false;

// ---------------------------------------------------------------------------
// Symbol Discovery
// ---------------------------------------------------------------------------

async function getActiveSymbols(): Promise<string[]> {
  try {
    const rows = await db
      .select({ symbol: backtestRunsTable.symbol })
      .from(backtestRunsTable)
      .where(eq(backtestRunsTable.status, "completed"))
      .groupBy(backtestRunsTable.symbol)
      .orderBy(sql`count(*) desc`)
      .limit(10);
    return rows.map((r) => r.symbol).filter(Boolean);
  } catch {
    return ["BTCUSDT"];
  }
}

// ---------------------------------------------------------------------------
// Safe Runner (non-fatal wrapper)
// ---------------------------------------------------------------------------

async function safeRun(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    logger.warn({ err, task: name }, `Intelligence task "${name}" failed — continuing`);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

export async function startIntelligenceScheduler(): Promise<void> {
  if (isStarted) {
    logger.warn("Intelligence scheduler already started");
    return;
  }

  logger.info("Starting Phase 11 Intelligence Scheduler");

  // Run an initial sweep on startup (deferred 30s to let other services init)
  setTimeout(async () => {
    await safeRun("initial-regime-detection", async () => {
      const symbols = await getActiveSymbols();
      if (symbols.length > 0) await runRegimeDetectionForSymbols(symbols);
    });
    await safeRun("initial-rankings", () => runAllRankings());
    await safeRun("initial-clustering", () => computeAndPersistClusters("correlation"));
  }, 30_000);

  // Regime detection: every 60 minutes
  regimeTimer = setInterval(async () => {
    await safeRun("regime-detection", async () => {
      const symbols = await getActiveSymbols();
      if (symbols.length > 0) await runRegimeDetectionForSymbols(symbols);
    });
  }, 60 * 60 * 1000);

  // Rankings: every 6 hours
  rankingTimer = setInterval(async () => {
    await safeRun("rankings", () => runAllRankings());
  }, 6 * 60 * 60 * 1000);

  // Clustering: every 12 hours
  clusteringTimer = setInterval(async () => {
    await safeRun("clustering", () => computeAndPersistClusters("correlation"));
  }, 12 * 60 * 60 * 1000);

  // Research coordination: every 30 minutes
  coordinationTimer = setInterval(async () => {
    await safeRun("research-coordination", () => runCoordinationCycle());
  }, 30 * 60 * 1000);

  // Learning cycle: every 2 hours
  learningTimer = setInterval(async () => {
    await safeRun("learning-cycle", () => runLearningCycle());
  }, 2 * 60 * 60 * 1000);

  isStarted = true;
  logger.info(
    {
      regimeIntervalMin: 60,
      rankingIntervalHr: 6,
      clusteringIntervalHr: 12,
      coordinationIntervalMin: 30,
      learningIntervalHr: 2,
    },
    "Phase 11 Intelligence Scheduler started",
  );
}

export function stopIntelligenceScheduler(): void {
  if (regimeTimer) clearInterval(regimeTimer);
  if (rankingTimer) clearInterval(rankingTimer);
  if (clusteringTimer) clearInterval(clusteringTimer);
  if (coordinationTimer) clearInterval(coordinationTimer);
  if (learningTimer) clearInterval(learningTimer);
  isStarted = false;
  logger.info("Intelligence scheduler stopped");
}

export function getSchedulerStatus(): {
  isRunning: boolean;
  intervals: Record<string, string>;
} {
  return {
    isRunning: isStarted,
    intervals: {
      regime_detection: "60 minutes",
      rankings: "6 hours",
      clustering: "12 hours",
      research_coordination: "30 minutes",
      learning_cycle: "2 hours",
    },
  };
}
