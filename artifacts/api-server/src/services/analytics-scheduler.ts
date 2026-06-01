/**
 * analytics-scheduler.ts
 *
 * Phase 7 — Portfolio Intelligence & Analytics Scheduler.
 * Runs periodic jobs to keep analytics data fresh:
 *
 * Loop 1 (benchmark refresh):    every 60 minutes — update benchmark prices + snapshots
 * Loop 2 (portfolio analytics):  every 30 minutes — full analytics snapshot per account
 * Loop 3 (health scores):        every 60 minutes — health score refresh per account
 * Loop 4 (attribution):          every 6 hours    — attribution computation per account
 * Loop 5 (allocation snapshots): every 30 minutes — allocation drift tracking
 * Loop 6 (recommendations):      every 60 minutes — rule-based recommendation refresh
 */

import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { refreshBenchmarkSnapshots } from "./benchmark-service";
import { computeAndSavePerformance } from "./performance-engine";
import { computeAndSaveHealthScore } from "./health-engine";
import { computeAndSaveAttribution } from "./attribution-engine";
import { computeAndSaveAllocation } from "./allocation-tracker";
import { computeDiversificationAnalysis } from "./diversification-engine";
import { generateAndSaveRecommendations } from "./recommendation-engine";
import { upsertPortfolioAnalytics, getDefaultBenchmark } from "./analytics-db";
import { appendAnalyticsAuditLog } from "./analytics-db";
import { logger } from "../lib/logger";

const BENCHMARK_INTERVAL_MS = 60 * 60 * 1000;      // 60 min
const ANALYTICS_INTERVAL_MS = 30 * 60 * 1000;      // 30 min
const HEALTH_INTERVAL_MS = 60 * 60 * 1000;         // 60 min
const ATTRIBUTION_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 h
const ALLOCATION_INTERVAL_MS = 30 * 60 * 1000;     // 30 min
const RECOMMENDATION_INTERVAL_MS = 60 * 60 * 1000; // 60 min

let handles: ReturnType<typeof setInterval>[] = [];
let running = false;

// ---------------------------------------------------------------------------
// Get all active paper accounts
// ---------------------------------------------------------------------------
async function getActiveAccounts(): Promise<string[]> {
  const rows = await db
    .select({ id: paperAccountsTable.id })
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.status, "active"));
  return rows.map(r => r.id);
}

// ---------------------------------------------------------------------------
// Per-account analytics refresh
// ---------------------------------------------------------------------------
async function refreshAnalyticsForAccount(accountId: string): Promise<void> {
  try {
    const defaultBenchmark = await getDefaultBenchmark();

    // Performance
    await computeAndSavePerformance(accountId, defaultBenchmark?.id);

    // Allocation
    const allocation = await computeAndSaveAllocation(accountId);

    // Diversification
    const diversification = await computeDiversificationAnalysis(accountId);

    // Health
    const health = await computeAndSaveHealthScore(accountId);

    // Update top-level analytics snapshot
    await upsertPortfolioAnalytics({
      accountId,
      snapshotAt: new Date(),
      diversificationScore: String(diversification.overallDiversificationScore),
      healthScore: String(health.overallScore),
      healthGrade: health.grade,
      capitalEfficiencyScore: String(parseFloat(health.capitalEfficiencyScore ?? "0")),
      openPositions: allocation.activePositionCount,
      activeStrategies: allocation.activeStrategyCount,
    });

    logger.info({ accountId }, "Analytics refresh complete");
  } catch (err) {
    logger.error({ err, accountId }, "Analytics refresh failed for account");
    await appendAnalyticsAuditLog({
      actor: "scheduler",
      action: "analytics.refresh",
      accountId,
      result: "failure",
      errorMessage: err instanceof Error ? err.message : String(err),
    }).catch(() => {});
  }
}

async function refreshRecommendationsForAccount(accountId: string): Promise<void> {
  try {
    const [diversification, allocation, healthScore] = await Promise.all([
      computeDiversificationAnalysis(accountId),
      computeAndSaveAllocation(accountId),
      computeAndSaveHealthScore(accountId),
    ]);

    await generateAndSaveRecommendations({
      accountId,
      health: {
        overallScore: parseFloat(healthScore.overallScore),
        grade: healthScore.grade,
        details: (healthScore.details as Record<string, unknown>) ?? {},
      },
      diversification,
      allocation,
    });
  } catch (err) {
    logger.error({ err, accountId }, "Recommendation refresh failed");
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

export function startAnalyticsScheduler(): void {
  if (running) {
    logger.warn("Analytics scheduler already running");
    return;
  }
  running = true;
  logger.info("Starting analytics scheduler (Phase 7)");

  // Loop 1 — Benchmark refresh (60 min)
  handles.push(
    setInterval(async () => {
      logger.info("Analytics scheduler: refreshing benchmarks");
      await refreshBenchmarkSnapshots().catch(err =>
        logger.error({ err }, "Benchmark refresh loop failed"),
      );
    }, BENCHMARK_INTERVAL_MS),
  );

  // Loop 2 — Portfolio analytics + allocation (30 min)
  handles.push(
    setInterval(async () => {
      logger.info("Analytics scheduler: refreshing portfolio analytics");
      const accounts = await getActiveAccounts().catch(() => []);
      for (const accountId of accounts) {
        await refreshAnalyticsForAccount(accountId);
      }
    }, ANALYTICS_INTERVAL_MS),
  );

  // Loop 3 — Health scores (60 min)
  handles.push(
    setInterval(async () => {
      logger.info("Analytics scheduler: refreshing health scores");
      const accounts = await getActiveAccounts().catch(() => []);
      for (const accountId of accounts) {
        await computeAndSaveHealthScore(accountId).catch(err =>
          logger.error({ err, accountId }, "Health score refresh failed"),
        );
      }
    }, HEALTH_INTERVAL_MS),
  );

  // Loop 4 — Attribution (6 h)
  handles.push(
    setInterval(async () => {
      logger.info("Analytics scheduler: refreshing attribution");
      const accounts = await getActiveAccounts().catch(() => []);
      for (const accountId of accounts) {
        await computeAndSaveAttribution(accountId).catch(err =>
          logger.error({ err, accountId }, "Attribution refresh failed"),
        );
      }
    }, ATTRIBUTION_INTERVAL_MS),
  );

  // Loop 5 — Allocation snapshots (30 min)
  handles.push(
    setInterval(async () => {
      logger.info("Analytics scheduler: saving allocation snapshots");
      const accounts = await getActiveAccounts().catch(() => []);
      for (const accountId of accounts) {
        await computeAndSaveAllocation(accountId).catch(err =>
          logger.error({ err, accountId }, "Allocation snapshot failed"),
        );
      }
    }, ALLOCATION_INTERVAL_MS),
  );

  // Loop 6 — Recommendations (60 min)
  handles.push(
    setInterval(async () => {
      logger.info("Analytics scheduler: refreshing recommendations");
      const accounts = await getActiveAccounts().catch(() => []);
      for (const accountId of accounts) {
        await refreshRecommendationsForAccount(accountId);
      }
    }, RECOMMENDATION_INTERVAL_MS),
  );

  logger.info("Analytics scheduler started (6 loops)");
}

export function stopAnalyticsScheduler(): void {
  for (const h of handles) clearInterval(h);
  handles = [];
  running = false;
  logger.info("Analytics scheduler stopped");
}
