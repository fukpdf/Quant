/**
 * service-health-engine.ts — Per-service health checks for Phase 12.
 *
 * Queries each phase's tables to derive the current health status of every
 * major subsystem. Writes one row per service to service_health on each cycle.
 */

import { db } from "@workspace/db";
import { desc, sql, gte } from "drizzle-orm";
import {
  ingestionJobsTable,
  streamHealthTable,
  paperAccountsTable,
  riskProfilesTable,
  executionOrdersTable,
  aiUsageMetricsTable,
  marketRegimesTable,
  dataQualityChecksTable,
} from "@workspace/db/schema";
import { insertServiceHealth, insertUptimeHistory, getOpenUptimeWindow, closeUptimeWindow } from "./ops-db";
import { logger } from "../lib/logger";

type ServiceStatus = "running" | "degraded" | "failed" | "maintenance";

interface ServiceCheckResult {
  service: string;
  status: ServiceStatus;
  healthScore: number;
  message: string;
  details: Record<string, unknown>;
  isEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Individual service checks
// ---------------------------------------------------------------------------

async function checkIngestion(): Promise<ServiceCheckResult> {
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000); // 10 min
    const [row] = await db
      .select({ count: sql<number>`count(*)::int`, succeeded: sql<number>`sum(case when status='succeeded' then 1 else 0 end)::int` })
      .from(ingestionJobsTable)
      .where(gte(ingestionJobsTable.createdAt, since));
    const total = row?.count ?? 0;
    const succeeded = row?.succeeded ?? 0;
    const successRate = total > 0 ? succeeded / total : 1;
    const score = Math.round(successRate * 100);
    const status: ServiceStatus = score >= 80 ? "running" : score >= 50 ? "degraded" : "failed";
    return {
      service: "ingestion",
      status,
      healthScore: score,
      message: total === 0 ? "No ingestion jobs in last 10 min" : `${succeeded}/${total} jobs succeeded`,
      details: { totalJobs: total, succeededJobs: succeeded, successRate },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "ingestion", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkStreaming(): Promise<ServiceCheckResult> {
  try {
    const [row] = await db
      .select()
      .from(streamHealthTable)
      .orderBy(desc(streamHealthTable.createdAt))
      .limit(1);
    if (!row) {
      return { service: "streaming", status: "degraded", healthScore: 50, message: "No stream health data", details: {}, isEnabled: true };
    }
    const score = row.healthScore ? parseFloat(String(row.healthScore)) : 50;
    const status: ServiceStatus =
      row.connectionStatus === "healthy" ? "running"
      : row.connectionStatus === "degraded" ? "degraded"
      : "failed";
    return {
      service: "streaming",
      status,
      healthScore: Math.round(score),
      message: `Provider ${row.provider}: ${row.connectionStatus}`,
      details: { provider: row.provider, connectionStatus: row.connectionStatus, score },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "streaming", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkPaperTrading(): Promise<ServiceCheckResult> {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(paperAccountsTable);
    const count = row?.count ?? 0;
    return {
      service: "paper_trading",
      status: "running",
      healthScore: 100,
      message: `${count} paper account(s) active`,
      details: { accountCount: count },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "paper_trading", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkRiskEngine(): Promise<ServiceCheckResult> {
  try {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(riskProfilesTable);
    const count = row?.count ?? 0;
    return {
      service: "risk_engine",
      status: "running",
      healthScore: 100,
      message: `${count} risk profile(s) loaded`,
      details: { profileCount: count },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "risk_engine", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkExecution(): Promise<ServiceCheckResult> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000); // 1h
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(executionOrdersTable)
      .where(gte(executionOrdersTable.createdAt, since));
    const count = row?.count ?? 0;
    return {
      service: "execution",
      status: "running",
      healthScore: 100,
      message: `${count} order(s) in last 1h (simulation mode)`,
      details: { recentOrders: count, mode: "simulation" },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "execution", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkAiResearch(): Promise<ServiceCheckResult> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int`, failures: sql<number>`sum(case when error_message is not null then 1 else 0 end)::int` })
      .from(aiUsageMetricsTable)
      .where(gte(aiUsageMetricsTable.createdAt, since));
    const total = row?.count ?? 0;
    const failures = row?.failures ?? 0;
    const failRate = total > 0 ? failures / total : 0;
    const score = Math.round((1 - failRate) * 100);
    const status: ServiceStatus = failRate < 0.1 ? "running" : failRate < 0.3 ? "degraded" : "failed";
    return {
      service: "ai_research",
      status,
      healthScore: score,
      message: total === 0 ? "No AI requests in last 1h" : `${failures}/${total} failures`,
      details: { totalRequests: total, failures, failureRate: failRate },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "ai_research", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkIntelligence(): Promise<ServiceCheckResult> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketRegimesTable)
      .where(gte(marketRegimesTable.createdAt, since));
    const count = row?.count ?? 0;
    return {
      service: "intelligence",
      status: "running",
      healthScore: 100,
      message: `${count} regime detection(s) in last 24h`,
      details: { recentRegimes: count },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "intelligence", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

async function checkDataQuality(): Promise<ServiceCheckResult> {
  try {
    const since = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h
    const [row] = await db
      .select({
        count: sql<number>`count(*)::int`,
        passed: sql<number>`sum(case when status='passed' then 1 else 0 end)::int`,
      })
      .from(dataQualityChecksTable)
      .where(gte(dataQualityChecksTable.checkedAt, since));
    const total = row?.count ?? 0;
    const passed = row?.passed ?? 0;
    const score = total > 0 ? Math.round((passed / total) * 100) : 100;
    const status: ServiceStatus = score >= 80 ? "running" : score >= 60 ? "degraded" : "failed";
    return {
      service: "data_quality",
      status,
      healthScore: score,
      message: total === 0 ? "No quality checks in last 2h" : `${passed}/${total} checks passed`,
      details: { totalChecks: total, passed, score },
      isEnabled: true,
    };
  } catch (err) {
    return { service: "data_quality", status: "failed", healthScore: 0, message: String(err), details: {}, isEnabled: true };
  }
}

// ---------------------------------------------------------------------------
// Uptime tracking helper
// ---------------------------------------------------------------------------

async function trackUptime(service: string, status: ServiceStatus) {
  try {
    const uptimeStatus = status === "running" ? "up" : status === "degraded" ? "degraded" : "down";
    const open = await getOpenUptimeWindow(service);
    if (open) {
      const prevStatus = open.status;
      if (prevStatus !== uptimeStatus) {
        await closeUptimeWindow(open.id, new Date());
        await insertUptimeHistory({ service, status: uptimeStatus, fromTime: new Date(), reason: `Status changed from ${prevStatus} to ${uptimeStatus}` });
      }
    } else {
      await insertUptimeHistory({ service, status: uptimeStatus, fromTime: new Date() });
    }
  } catch {
    // non-fatal
  }
}

// ---------------------------------------------------------------------------
// Run all service checks
// ---------------------------------------------------------------------------

export async function runAllServiceHealthChecks(): Promise<void> {
  const checks = await Promise.allSettled([
    checkIngestion(),
    checkStreaming(),
    checkPaperTrading(),
    checkRiskEngine(),
    checkExecution(),
    checkAiResearch(),
    checkIntelligence(),
    checkDataQuality(),
  ]);

  for (const result of checks) {
    if (result.status === "fulfilled") {
      const check = result.value;
      try {
        await insertServiceHealth({
          service: check.service,
          status: check.status,
          healthScore: String(check.healthScore),
          isEnabled: check.isEnabled,
          message: check.message,
          details: check.details,
          lastSuccessAt: check.status === "running" ? new Date() : undefined,
          consecutiveFailures: "0",
        });
        await trackUptime(check.service, check.status);
      } catch (err) {
        logger.warn({ err, service: check.service }, "Failed to persist service health");
      }
    } else {
      logger.warn({ reason: result.reason }, "Service health check failed");
    }
  }
}
