/**
 * execution-health-engine.ts — Execution engine health computation for Phase 12.
 *
 * Queries execution_orders and execution_fills to compute aggregated
 * health metrics for multiple time windows and persists to execution_health.
 */

import { db } from "@workspace/db";
import { and, sql, gte, eq } from "drizzle-orm";
import { executionOrdersTable, executionFillsTable, executionLatencyTable } from "@workspace/db/schema";
import { insertExecutionHealth } from "./ops-db";
import { logger } from "../lib/logger";

const WINDOWS: Array<{ label: string; ms: number }> = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "4h", ms: 4 * 60 * 60 * 1000 },
  { label: "1d", ms: 24 * 60 * 60 * 1000 },
];

async function computeExecutionHealth(window: { label: string; ms: number }) {
  try {
    const since = new Date(Date.now() - window.ms);

    const [orderRow] = await db
      .select({
        total: sql<number>`count(*)::int`,
        filled: sql<number>`sum(case when status='filled' then 1 else 0 end)::int`,
        rejected: sql<number>`sum(case when status='rejected' then 1 else 0 end)::int`,
        cancelled: sql<number>`sum(case when status='cancelled' then 1 else 0 end)::int`,
      })
      .from(executionOrdersTable)
      .where(gte(executionOrdersTable.createdAt, since));

    const total = orderRow?.total ?? 0;
    const filled = orderRow?.filled ?? 0;
    const rejected = orderRow?.rejected ?? 0;
    const cancelled = orderRow?.cancelled ?? 0;

    const fillRate = total > 0 ? filled / total : 0;
    const rejectionRate = total > 0 ? rejected / total : 0;
    const errorRate = total > 0 ? (rejected) / total : 0;

    // Latency from execution_latency (end_to_end stage = total order latency)
    const [latRow] = await db
      .select({
        avg: sql<number>`avg(${executionLatencyTable.latencyMs})`,
        p95: sql<number>`percentile_cont(0.95) within group (order by ${executionLatencyTable.latencyMs})`,
      })
      .from(executionLatencyTable)
      .where(and(gte(executionLatencyTable.createdAt, since), eq(executionLatencyTable.stage, "end_to_end")));

    const avgLatencyMs = latRow?.avg ?? null;
    const p95LatencyMs = latRow?.p95 ?? null;

    const healthScore = Math.round(
      Math.max(0, Math.min(100,
        100 - rejectionRate * 50 - errorRate * 30,
      )),
    );
    const status = healthScore >= 80 ? "healthy" : healthScore >= 50 ? "degraded" : "failed";

    await insertExecutionHealth({
      window: window.label,
      status,
      healthScore: String(healthScore),
      totalOrders: total,
      filledOrders: filled,
      rejectedOrders: rejected,
      cancelledOrders: cancelled,
      fillRate: fillRate.toFixed(4),
      rejectionRate: rejectionRate.toFixed(4),
      avgLatencyMs: avgLatencyMs !== null ? Number(avgLatencyMs).toFixed(2) : null,
      p95LatencyMs: p95LatencyMs !== null ? Number(p95LatencyMs).toFixed(2) : null,
      avgSlippageBps: null,
      errorRate: errorRate.toFixed(4),
      executionMode: "simulation",
    });
  } catch (err) {
    logger.warn({ err, window: window.label }, "Failed to compute execution health");
  }
}

export async function runExecutionHealthChecks(): Promise<void> {
  await Promise.allSettled(WINDOWS.map((w) => computeExecutionHealth(w)));
}
