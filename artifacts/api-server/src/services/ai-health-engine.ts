/**
 * ai-health-engine.ts — AI system health computation for Phase 12.
 *
 * Queries ai_usage_metrics to compute per-provider health scores
 * for multiple time windows and persists to ai_health table.
 */

import { db } from "@workspace/db";
import { and, sql, gte } from "drizzle-orm";
import { aiUsageMetricsTable } from "@workspace/db/schema";
import { insertAiHealth } from "./ops-db";
import { logger } from "../lib/logger";
import { AiProviderFactory } from "./ai-provider-factory";

const WINDOWS: Array<{ label: string; ms: number }> = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "4h", ms: 4 * 60 * 60 * 1000 },
  { label: "1d", ms: 24 * 60 * 60 * 1000 },
];

async function computeAiHealth(provider: string, window: { label: string; ms: number }) {
  try {
    const since = new Date(Date.now() - window.ms);

    const [row] = await db
      .select({
        totalRequests: sql<number>`count(*)::int`,
        totalTokens: sql<number>`coalesce(sum(${aiUsageMetricsTable.totalTokens}),0)::int`,
        failures: sql<number>`sum(case when ${aiUsageMetricsTable.status} != 'success' then 1 else 0 end)::int`,
        avgLatency: sql<number>`avg(${aiUsageMetricsTable.latencyMs})`,
        p95Latency: sql<number>`percentile_cont(0.95) within group (order by ${aiUsageMetricsTable.latencyMs})`,
      })
      .from(aiUsageMetricsTable)
      .where(gte(aiUsageMetricsTable.createdAt, since));

    const total = row?.totalRequests ?? 0;
    const tokens = row?.totalTokens ?? 0;
    const failures = row?.failures ?? 0;
    const avgLatencyMs = row?.avgLatency ?? null;
    const p95LatencyMs = row?.p95Latency ?? null;

    const failureRate = total > 0 ? failures / total : 0;
    const availabilityRate = total > 0 ? 1 - failureRate : 1;
    const healthScore = Math.round(availabilityRate * 100);
    const status = failureRate < 0.05 ? "healthy" : failureRate < 0.2 ? "degraded" : "unavailable";

    await insertAiHealth({
      provider,
      window: window.label,
      status,
      healthScore: String(healthScore),
      totalRequests: total,
      totalTokens: tokens,
      failureCount: failures,
      avgLatencyMs: avgLatencyMs !== null ? Number(avgLatencyMs).toFixed(2) : null,
      p95LatencyMs: p95LatencyMs !== null ? Number(p95LatencyMs).toFixed(2) : null,
      availabilityRate: availabilityRate.toFixed(4),
      failureRate: failureRate.toFixed(4),
    });
  } catch (err) {
    logger.warn({ err, provider, window: window.label }, "Failed to compute AI health");
  }
}

export async function runAiHealthChecks(): Promise<void> {
  try {
    const provider = AiProviderFactory.getProvider().name;
    await Promise.allSettled(
      WINDOWS.map((w) => computeAiHealth(provider, w)),
    );
  } catch (err) {
    logger.warn({ err }, "AI health check run failed");
  }
}
