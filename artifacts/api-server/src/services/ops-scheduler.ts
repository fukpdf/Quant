/**
 * ops-scheduler.ts — Phase 12 Observability & Operations Scheduler.
 *
 * Manages the lifecycle of all Phase 12 monitoring loops.
 * Non-fatal: if the ops layer fails, the API server continues normally.
 *
 * Polling intervals:
 *   System metrics collection:     every 30 seconds
 *   Service health checks:         every 2 minutes
 *   Alert rule evaluation:         every 60 seconds
 *   Scheduler health snapshot:     every 60 seconds
 *   Stream health snapshot:        every 2 minutes
 *   Strategy health checks:        every 5 minutes
 *   AI health checks:              every 15 minutes
 *   Execution health checks:       every 15 minutes
 *   Incident auto-scan:            every 5 minutes
 *   Performance snapshot:          every 15 minutes
 */

import { logger } from "../lib/logger";
import { collectAndPersistMetrics } from "./metrics-collector";
import { runAllServiceHealthChecks } from "./service-health-engine";
import { evaluateAllAlertRules, seedDefaultAlertRules } from "./alert-engine";
import { scanAndAutoOpenIncidents } from "./incident-manager";
import { runStrategyHealthChecks } from "./strategy-health-engine";
import { runAiHealthChecks } from "./ai-health-engine";
import { runExecutionHealthChecks } from "./execution-health-engine";
import {
  persistAllSchedulerHealth,
  registerAllKnownSchedulers,
  recordSchedulerStart,
  recordSchedulerComplete,
  recordSchedulerFailure,
} from "./scheduler-monitor";
import {
  getLatestSystemMetrics,
  listLatestServiceHealth,
  getActiveAlertCount,
  getOpenIncidentCount,
  insertPerformanceSnapshot,
  getLatestExecutionHealth,
  listLatestAiHealth,
  listLatestStreamHealthHistory,
  insertStreamHealthHistory,
} from "./ops-db";
import { db } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { streamHealthTable } from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Timer handles
// ---------------------------------------------------------------------------

let metricsTimer: NodeJS.Timeout | null = null;
let serviceHealthTimer: NodeJS.Timeout | null = null;
let alertTimer: NodeJS.Timeout | null = null;
let schedulerSnapshotTimer: NodeJS.Timeout | null = null;
let streamSnapshotTimer: NodeJS.Timeout | null = null;
let strategyHealthTimer: NodeJS.Timeout | null = null;
let aiHealthTimer: NodeJS.Timeout | null = null;
let executionHealthTimer: NodeJS.Timeout | null = null;
let incidentScanTimer: NodeJS.Timeout | null = null;
let performanceSnapshotTimer: NodeJS.Timeout | null = null;

let isStarted = false;

// ---------------------------------------------------------------------------
// Safe runner
// ---------------------------------------------------------------------------

async function safeRun(name: string, fn: () => Promise<void>) {
  recordSchedulerStart(name);
  try {
    await fn();
    recordSchedulerComplete(name);
  } catch (err) {
    recordSchedulerFailure(name, String(err));
    logger.warn({ err, scheduler: name }, "Ops scheduler task failed (non-fatal)");
  }
}

// ---------------------------------------------------------------------------
// Stream health snapshot — reads Phase 9 stream_health into Phase 12 history
// ---------------------------------------------------------------------------

async function snapshotStreamHealth() {
  try {
    const rows = await db
      .select()
      .from(streamHealthTable)
      .orderBy(desc(streamHealthTable.createdAt))
      .limit(20);

    // Dedup: latest per provider
    const seenProviders = new Set<string>();
    for (const row of rows) {
      if (seenProviders.has(row.provider)) continue;
      seenProviders.add(row.provider);
      await insertStreamHealthHistory({
        provider: row.provider,
        connectionStatus: row.connectionStatus,
        healthScore: row.healthScore,
        avgLatencyMs: row.avgLatencyMs,
        p99LatencyMs: row.p99LatencyMs,
        ticksPerSecond: row.ticksPerSecond,
        reconnectCount: row.reconnectCount,
        failureCount: row.failureCount,
        subscribedSymbols: row.subscribedSymbols,
        lastTickAgeSeconds: row.lastTickAgeSeconds,
      });
    }
  } catch {
    // non-fatal: Phase 9 tables may be empty
  }
}

// ---------------------------------------------------------------------------
// Performance snapshot computation
// ---------------------------------------------------------------------------

async function computeAndPersistPerformanceSnapshot() {
  try {
    const [latestMetrics, serviceRows, activeAlerts, openIncidents] = await Promise.all([
      getLatestSystemMetrics(),
      listLatestServiceHealth(),
      getActiveAlertCount(),
      getOpenIncidentCount(),
    ]);

    const services = serviceRows.map((r) => r.sh);
    const degradedServices = services.filter((s) => s.status !== "running").length;
    const totalServices = Math.max(services.length, 1);

    // Component scores — weight each layer's health
    const serviceScore = Math.round(
      services.reduce((sum, s) => sum + parseFloat(String(s.healthScore ?? 100)), 0) / totalServices,
    );

    // Alert penalty: each active alert reduces score by 5, capped at 30
    const alertPenalty = Math.min(30, activeAlerts * 5);
    // Incident penalty: each open incident reduces score by 10, capped at 40
    const incidentPenalty = Math.min(40, openIncidents * 10);

    const overallScore = Math.max(0, Math.min(100, serviceScore - alertPenalty - incidentPenalty));

    const observations: string[] = [];
    if (activeAlerts > 0) observations.push(`${activeAlerts} active alert(s) require attention`);
    if (openIncidents > 0) observations.push(`${openIncidents} open incident(s)`);
    if (degradedServices > 0) observations.push(`${degradedServices} service(s) are degraded or failed`);
    if (overallScore >= 90) observations.push("Platform is operating normally");

    const componentScores: Record<string, number> = {};
    for (const s of services) {
      componentScores[s.service] = parseFloat(String(s.healthScore ?? 100));
    }

    await insertPerformanceSnapshot({
      overallScore,
      componentScores,
      activeAlerts,
      openIncidents,
      degradedServices,
      missedSchedulers: 0,
      observations,
      memoryRssMb: latestMetrics?.memoryRssMb,
      cpuPercent: latestMetrics?.cpuPercent,
    });
  } catch (err) {
    logger.warn({ err }, "Failed to compute performance snapshot");
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function startOpsScheduler(): Promise<void> {
  if (isStarted) return;
  isStarted = true;

  // Seed default alert rules and register schedulers
  await seedDefaultAlertRules();
  registerAllKnownSchedulers();

  // Immediate first runs
  await safeRun("ops_metrics", collectAndPersistMetrics);
  await safeRun("ops_service_health", runAllServiceHealthChecks);

  // 30-second metrics collection
  metricsTimer = setInterval(() => {
    safeRun("ops_metrics", collectAndPersistMetrics);
  }, 30_000);

  // 2-minute service health checks
  serviceHealthTimer = setInterval(() => {
    safeRun("ops_service_health", runAllServiceHealthChecks);
  }, 2 * 60_000);

  // 60-second alert evaluation
  alertTimer = setInterval(() => {
    safeRun("ops_alert_evaluation", evaluateAllAlertRules);
  }, 60_000);

  // 60-second scheduler health snapshot
  schedulerSnapshotTimer = setInterval(() => {
    persistAllSchedulerHealth().catch(() => {});
  }, 60_000);

  // 2-minute stream health snapshot
  streamSnapshotTimer = setInterval(() => {
    snapshotStreamHealth().catch(() => {});
  }, 2 * 60_000);

  // 5-minute strategy health checks
  strategyHealthTimer = setInterval(() => {
    safeRun("ops_service_health", runStrategyHealthChecks);
  }, 5 * 60_000);

  // 15-minute AI health checks
  aiHealthTimer = setInterval(() => {
    runAiHealthChecks().catch(() => {});
  }, 15 * 60_000);

  // 15-minute execution health checks
  executionHealthTimer = setInterval(() => {
    runExecutionHealthChecks().catch(() => {});
  }, 15 * 60_000);

  // 5-minute incident auto-scan
  incidentScanTimer = setInterval(() => {
    scanAndAutoOpenIncidents().catch(() => {});
  }, 5 * 60_000);

  // 15-minute performance snapshot
  performanceSnapshotTimer = setInterval(() => {
    safeRun("ops_performance_snapshot", computeAndPersistPerformanceSnapshot);
  }, 15 * 60_000);

  logger.info("Phase 12: Ops scheduler started — metrics, health checks, alerts, incidents active");
}

export function stopOpsScheduler(): void {
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null; }
  if (serviceHealthTimer) { clearInterval(serviceHealthTimer); serviceHealthTimer = null; }
  if (alertTimer) { clearInterval(alertTimer); alertTimer = null; }
  if (schedulerSnapshotTimer) { clearInterval(schedulerSnapshotTimer); schedulerSnapshotTimer = null; }
  if (streamSnapshotTimer) { clearInterval(streamSnapshotTimer); streamSnapshotTimer = null; }
  if (strategyHealthTimer) { clearInterval(strategyHealthTimer); strategyHealthTimer = null; }
  if (aiHealthTimer) { clearInterval(aiHealthTimer); aiHealthTimer = null; }
  if (executionHealthTimer) { clearInterval(executionHealthTimer); executionHealthTimer = null; }
  if (incidentScanTimer) { clearInterval(incidentScanTimer); incidentScanTimer = null; }
  if (performanceSnapshotTimer) { clearInterval(performanceSnapshotTimer); performanceSnapshotTimer = null; }
  isStarted = false;
  logger.info("Phase 12: Ops scheduler stopped");
}

export function getOpsSchedulerStatus() {
  return {
    isRunning: isStarted,
    intervals: {
      systemMetrics: "30s",
      serviceHealth: "2m",
      alertEvaluation: "60s",
      schedulerSnapshot: "60s",
      streamSnapshot: "2m",
      strategyHealth: "5m",
      aiHealth: "15m",
      executionHealth: "15m",
      incidentScan: "5m",
      performanceSnapshot: "15m",
    },
  };
}
