/**
 * alert-engine.ts — Alert rule evaluation and event firing for Phase 12.
 *
 * Seeds default alert rules on startup.
 * Evaluates enabled rules every minute against current system state.
 * Respects per-rule cooldown periods to prevent alert storms.
 */

import { db } from "@workspace/db";
import { desc, sql, gte, lt, eq } from "drizzle-orm";
import {
  systemMetricsTable,
  serviceHealthTable,
  schedulerHealthTable,
  streamHealthTable,
  ingestionJobsTable,
  executionOrdersTable,
} from "@workspace/db/schema";
import {
  listAlertRules,
  upsertAlertRule,
  insertAlertEvent,
  getLastAlertFiredAt,
  insertMonitoringAuditLog,
} from "./ops-db";
import { logger } from "../lib/logger";
import type { AlertRuleDefinition } from "./ops-types";

// ---------------------------------------------------------------------------
// Default alert rule definitions
// ---------------------------------------------------------------------------

const DEFAULT_RULES: AlertRuleDefinition[] = [
  {
    name: "high_heap_usage",
    displayName: "High Heap Memory Usage",
    category: "system",
    severity: "warning",
    condition: "heap_used_mb > threshold",
    threshold: "512",
    cooldownMinutes: 30,
    description: "Node.js heap usage exceeds 512 MB — potential memory leak or heavy load",
  },
  {
    name: "critical_heap_usage",
    displayName: "Critical Heap Memory Usage",
    category: "system",
    severity: "critical",
    condition: "heap_used_mb > threshold",
    threshold: "1024",
    cooldownMinutes: 15,
    description: "Node.js heap usage exceeds 1 GB — server may OOM crash soon",
  },
  {
    name: "high_event_loop_lag",
    displayName: "High Event Loop Lag",
    category: "system",
    severity: "warning",
    condition: "event_loop_lag_ms > threshold",
    threshold: "100",
    cooldownMinutes: 15,
    description: "Event loop lag > 100ms indicates heavy synchronous CPU work blocking the main thread",
  },
  {
    name: "high_db_latency",
    displayName: "High DB Latency",
    category: "system",
    severity: "warning",
    condition: "db_latency_ms > threshold",
    threshold: "500",
    cooldownMinutes: 15,
    description: "DB ping latency > 500ms — database may be under load or experiencing connectivity issues",
  },
  {
    name: "service_failed",
    displayName: "Service Failed",
    category: "system",
    severity: "critical",
    condition: "service_status = failed",
    threshold: null,
    cooldownMinutes: 10,
    description: "One or more platform services are in 'failed' state",
  },
  {
    name: "service_degraded",
    displayName: "Service Degraded",
    category: "system",
    severity: "warning",
    condition: "service_status = degraded",
    threshold: null,
    cooldownMinutes: 20,
    description: "One or more platform services are in 'degraded' state",
  },
  {
    name: "scheduler_missed",
    displayName: "Scheduler Missed Execution",
    category: "scheduler",
    severity: "warning",
    condition: "scheduler_status = missed",
    threshold: null,
    cooldownMinutes: 30,
    description: "A background scheduler missed its expected execution window",
  },
  {
    name: "scheduler_failed",
    displayName: "Scheduler Execution Failed",
    category: "scheduler",
    severity: "critical",
    condition: "scheduler_status = failed",
    threshold: null,
    cooldownMinutes: 15,
    description: "A background scheduler threw an error during execution",
  },
  {
    name: "stream_disconnected",
    displayName: "Stream Provider Disconnected",
    category: "stream",
    severity: "critical",
    condition: "stream_status = disconnected OR stream_status = failed",
    threshold: null,
    cooldownMinutes: 10,
    description: "Real-time market data stream has disconnected or failed",
  },
  {
    name: "ingestion_failure_rate",
    displayName: "High Ingestion Failure Rate",
    category: "data",
    severity: "warning",
    condition: "ingestion_failure_rate > threshold",
    threshold: "0.2",
    cooldownMinutes: 30,
    description: "More than 20% of ingestion jobs are failing in the last 10 minutes",
  },
  {
    name: "no_ingestion_recent",
    displayName: "No Recent Ingestion Activity",
    category: "data",
    severity: "critical",
    condition: "last_ingestion_age_minutes > threshold",
    threshold: "15",
    cooldownMinutes: 30,
    description: "No successful ingestion job has run in the last 15 minutes",
  },
  {
    name: "execution_high_rejection_rate",
    displayName: "High Order Rejection Rate",
    category: "execution",
    severity: "warning",
    condition: "rejection_rate > threshold",
    threshold: "0.3",
    cooldownMinutes: 30,
    description: "More than 30% of orders are being rejected by the execution engine",
  },
];

// ---------------------------------------------------------------------------
// Seed default rules
// ---------------------------------------------------------------------------

export async function seedDefaultAlertRules(): Promise<void> {
  try {
    for (const rule of DEFAULT_RULES) {
      await upsertAlertRule({
        name: rule.name,
        displayName: rule.displayName,
        category: rule.category,
        severity: rule.severity,
        condition: rule.condition,
        threshold: rule.threshold,
        cooldownMinutes: rule.cooldownMinutes,
        description: rule.description,
        isEnabled: true,
      });
    }
    logger.info({ count: DEFAULT_RULES.length }, "Phase 12: Default alert rules seeded");
  } catch (err) {
    logger.warn({ err }, "Failed to seed default alert rules");
  }
}

// ---------------------------------------------------------------------------
// Cooldown check
// ---------------------------------------------------------------------------

async function isOnCooldown(ruleName: string, cooldownMinutes: number): Promise<boolean> {
  try {
    const lastFired = await getLastAlertFiredAt(ruleName);
    if (!lastFired) return false;
    const msSinceFired = Date.now() - lastFired.getTime();
    return msSinceFired < cooldownMinutes * 60 * 1000;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Fire alert
// ---------------------------------------------------------------------------

async function fireAlert(opts: {
  ruleName: string;
  severity: string;
  title: string;
  message: string;
  service?: string;
  triggerValue?: string;
  thresholdValue?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const event = await insertAlertEvent({
      ruleName: opts.ruleName,
      severity: opts.severity,
      status: "active",
      title: opts.title,
      message: opts.message,
      service: opts.service,
      triggerValue: opts.triggerValue,
      thresholdValue: opts.thresholdValue,
      details: opts.details ?? null,
    });
    await insertMonitoringAuditLog({
      actor: "system",
      action: "alert_fired",
      targetType: "alert",
      targetId: event?.id,
      description: opts.title,
      details: { ruleName: opts.ruleName, severity: opts.severity },
    });
  } catch (err) {
    logger.warn({ err, ruleName: opts.ruleName }, "Failed to fire alert");
  }
}

// ---------------------------------------------------------------------------
// Rule evaluators
// ---------------------------------------------------------------------------

async function evaluateSystemMetricRules() {
  try {
    const [row] = await db
      .select()
      .from(systemMetricsTable)
      .orderBy(desc(systemMetricsTable.createdAt))
      .limit(1);
    if (!row) return;

    const heapMb = row.heapUsedMb ? parseFloat(String(row.heapUsedMb)) : 0;
    const lagMs = row.eventLoopLagMs ? parseFloat(String(row.eventLoopLagMs)) : 0;
    const dbMs = row.dbLatencyMs ? parseFloat(String(row.dbLatencyMs)) : 0;

    if (heapMb > 1024 && !await isOnCooldown("critical_heap_usage", 15)) {
      await fireAlert({ ruleName: "critical_heap_usage", severity: "critical", title: "Critical Heap Memory Usage", message: `Heap is at ${heapMb.toFixed(0)} MB — exceeds 1 GB threshold`, service: "platform", triggerValue: heapMb.toFixed(0), thresholdValue: "1024" });
    } else if (heapMb > 512 && !await isOnCooldown("high_heap_usage", 30)) {
      await fireAlert({ ruleName: "high_heap_usage", severity: "warning", title: "High Heap Memory Usage", message: `Heap is at ${heapMb.toFixed(0)} MB — exceeds 512 MB threshold`, service: "platform", triggerValue: heapMb.toFixed(0), thresholdValue: "512" });
    }

    if (lagMs > 100 && !await isOnCooldown("high_event_loop_lag", 15)) {
      await fireAlert({ ruleName: "high_event_loop_lag", severity: "warning", title: "High Event Loop Lag", message: `Event loop lag is ${lagMs.toFixed(0)} ms`, service: "platform", triggerValue: lagMs.toFixed(0), thresholdValue: "100" });
    }

    if (dbMs > 500 && !await isOnCooldown("high_db_latency", 15)) {
      await fireAlert({ ruleName: "high_db_latency", severity: "warning", title: "High DB Latency", message: `DB ping latency is ${dbMs.toFixed(0)} ms`, service: "platform", triggerValue: dbMs.toFixed(0), thresholdValue: "500" });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to evaluate system metric rules");
  }
}

async function evaluateServiceHealthRules() {
  try {
    const failedServices = await db
      .select({ service: serviceHealthTable.service, maxCreated: sql<Date>`max(${serviceHealthTable.createdAt})` })
      .from(serviceHealthTable)
      .where(eq(serviceHealthTable.status, "failed"))
      .groupBy(serviceHealthTable.service);

    if (failedServices.length > 0 && !await isOnCooldown("service_failed", 10)) {
      const names = failedServices.map((s) => s.service).join(", ");
      await fireAlert({ ruleName: "service_failed", severity: "critical", title: "Service Failed", message: `The following services are in 'failed' state: ${names}`, service: names, details: { failedServices: failedServices.map((s) => s.service) } });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to evaluate service health rules");
  }
}

async function evaluateSchedulerRules() {
  try {
    const [failedRow] = await db
      .select({ count: sql<number>`count(*)::int`, names: sql<string>`string_agg(distinct ${schedulerHealthTable.schedulerName}, ', ')` })
      .from(schedulerHealthTable)
      .where(eq(schedulerHealthTable.status, "failed"));

    if ((failedRow?.count ?? 0) > 0 && !await isOnCooldown("scheduler_failed", 15)) {
      await fireAlert({ ruleName: "scheduler_failed", severity: "critical", title: "Scheduler Failed", message: `${failedRow!.count} scheduler(s) failed: ${failedRow!.names}`, service: "schedulers", details: { count: failedRow!.count } });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to evaluate scheduler rules");
  }
}

async function evaluateStreamRules() {
  try {
    const [row] = await db
      .select()
      .from(streamHealthTable)
      .orderBy(desc(streamHealthTable.createdAt))
      .limit(1);
    if (!row) return;
    if ((row.connectionStatus === "disconnected" || row.connectionStatus === "failed") && !await isOnCooldown("stream_disconnected", 10)) {
      await fireAlert({ ruleName: "stream_disconnected", severity: "critical", title: "Stream Provider Disconnected", message: `Provider ${row.provider} status: ${row.connectionStatus}`, service: "streaming", triggerValue: row.connectionStatus });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to evaluate stream rules");
  }
}

async function evaluateIngestionRules() {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000);
    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`sum(case when status='failed' then 1 else 0 end)::int`,
        lastSuccess: sql<Date>`max(case when status='succeeded' then ${ingestionJobsTable.createdAt} end)`,
      })
      .from(ingestionJobsTable)
      .where(gte(ingestionJobsTable.createdAt, since));

    const total = row?.total ?? 0;
    const failed = row?.failed ?? 0;
    const lastSuccess = row?.lastSuccess;

    if (total > 0) {
      const failRate = failed / total;
      if (failRate > 0.2 && !await isOnCooldown("ingestion_failure_rate", 30)) {
        await fireAlert({ ruleName: "ingestion_failure_rate", severity: "warning", title: "High Ingestion Failure Rate", message: `${(failRate * 100).toFixed(0)}% of ingestion jobs failing in last 10 min (${failed}/${total})`, service: "ingestion", triggerValue: failRate.toFixed(2), thresholdValue: "0.2" });
      }
    }

    if (!lastSuccess && !await isOnCooldown("no_ingestion_recent", 30)) {
      await fireAlert({ ruleName: "no_ingestion_recent", severity: "critical", title: "No Recent Ingestion Activity", message: "No successful ingestion job in the last 15 minutes", service: "ingestion" });
    }
  } catch (err) {
    logger.warn({ err }, "Failed to evaluate ingestion rules");
  }
}

// ---------------------------------------------------------------------------
// Main evaluation loop
// ---------------------------------------------------------------------------

export async function evaluateAllAlertRules(): Promise<void> {
  const enabledRules = await listAlertRules({ enabled: true });
  if (enabledRules.length === 0) return;

  await Promise.allSettled([
    evaluateSystemMetricRules(),
    evaluateServiceHealthRules(),
    evaluateSchedulerRules(),
    evaluateStreamRules(),
    evaluateIngestionRules(),
  ]);
}
