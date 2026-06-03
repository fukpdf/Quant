import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import {
  executionOrdersTable,
  executionFillsTable,
  executionLatencyTable,
} from "@workspace/db/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { insertExecutionMetric, listExecutionMetrics, insertExecutionAuditLog } from "./execution-db";
import type { ExecutionAnalyticsSummary } from "./execution-types";

/**
 * execution-analytics-engine.ts — Execution quality metrics (ADR-032).
 *
 * Computes and persists aggregated execution quality metrics:
 * - Fill rate, reject rate, cancel rate
 * - Average and percentile latencies
 * - Slippage distribution
 * - Provider performance breakdown
 *
 * Runs on a 5-minute interval per mode.
 */

const PERIODS = ["1h", "4h", "1d", "7d"] as const;
const PERIOD_MS: Record<string, number> = {
  "1h": 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

let analyticsInterval: ReturnType<typeof setInterval> | null = null;

export function startAnalyticsEngine(): void {
  if (analyticsInterval) return;

  // Compute immediately on start, then every 5 minutes
  computeAllAnalytics().catch((err) => logger.error({ err }, "Analytics: initial computation failed"));

  analyticsInterval = setInterval(async () => {
    try {
      await computeAllAnalytics();
    } catch (err) {
      logger.error({ err }, "Analytics: periodic computation failed");
    }
  }, 5 * 60 * 1000);

  logger.info("ExecutionAnalyticsEngine: started (5-minute interval)");
}

export function stopAnalyticsEngine(): void {
  if (analyticsInterval) {
    clearInterval(analyticsInterval);
    analyticsInterval = null;
  }
  logger.info("ExecutionAnalyticsEngine: stopped");
}

async function computeAllAnalytics(): Promise<void> {
  const modes = ["simulation", "paper", "live_disabled"];

  for (const mode of modes) {
    for (const period of PERIODS) {
      try {
        await computeAnalytics(mode, period);
      } catch (err) {
        logger.error({ err, mode, period }, "Analytics: computation failed");
      }
    }
  }
}

async function computeAnalytics(mode: string, period: string): Promise<void> {
  const since = new Date(Date.now() - PERIOD_MS[period]!);

  // Count orders by status in this period
  const orders = await db
    .select({
      status: executionOrdersTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(executionOrdersTable)
    .where(and(eq(executionOrdersTable.executionMode, mode), gte(executionOrdersTable.createdAt, since)))
    .groupBy(executionOrdersTable.status);

  if (orders.length === 0) return; // No data for this period

  let totalOrders = 0;
  let totalFills = 0;
  let totalRejections = 0;
  let totalCancellations = 0;

  for (const row of orders) {
    totalOrders += row.count;
    if (row.status === "filled" || row.status === "partially_filled") totalFills += row.count;
    if (row.status === "rejected") totalRejections += row.count;
    if (row.status === "cancelled") totalCancellations += row.count;
  }

  const fillRate = totalOrders > 0 ? totalFills / totalOrders : 0;
  const rejectRate = totalOrders > 0 ? totalRejections / totalOrders : 0;
  const cancelRate = totalOrders > 0 ? totalCancellations / totalOrders : 0;
  const successRate = totalOrders > 0 ? (totalFills + totalCancellations) / totalOrders : 0;

  // Latency metrics
  const latencies = await db
    .select({ stage: executionLatencyTable.stage, latencyMs: executionLatencyTable.latencyMs })
    .from(executionLatencyTable)
    .where(and(eq(executionLatencyTable.executionMode, mode), gte(executionLatencyTable.createdAt, since)))
    .orderBy(executionLatencyTable.latencyMs);

  const e2eLatencies = latencies
    .filter((l) => l.stage === "end_to_end")
    .map((l) => parseFloat(l.latencyMs as string))
    .sort((a, b) => a - b);

  const avgLatencyMs = e2eLatencies.length > 0
    ? e2eLatencies.reduce((a, b) => a + b, 0) / e2eLatencies.length
    : 0;
  const p50LatencyMs = percentile(e2eLatencies, 0.5);
  const p95LatencyMs = percentile(e2eLatencies, 0.95);
  const p99LatencyMs = percentile(e2eLatencies, 0.99);

  // Fill latency
  const fillLatencies = latencies
    .filter((l) => l.stage === "fill")
    .map((l) => parseFloat(l.latencyMs as string));
  const avgFillTimeMs = fillLatencies.length > 0
    ? fillLatencies.reduce((a, b) => a + b, 0) / fillLatencies.length
    : 0;

  // Slippage
  const fills = await db
    .select({ slippageBps: executionFillsTable.slippageBps })
    .from(executionFillsTable)
    .innerJoin(executionOrdersTable, eq(executionFillsTable.orderId, executionOrdersTable.id))
    .where(and(eq(executionOrdersTable.executionMode, mode), gte(executionFillsTable.filledAt, since)));

  const slippages = fills
    .filter((f) => f.slippageBps != null)
    .map((f) => parseFloat(f.slippageBps as string));
  const avgSlippageBps = slippages.length > 0
    ? slippages.reduce((a, b) => a + b, 0) / slippages.length
    : 0;

  await insertExecutionMetric({
    executionMode: mode,
    period,
    totalOrders: String(totalOrders),
    totalFills: String(totalFills),
    totalRejections: String(totalRejections),
    totalCancellations: String(totalCancellations),
    fillRate: fillRate.toFixed(6),
    rejectRate: rejectRate.toFixed(6),
    cancelRate: cancelRate.toFixed(6),
    successRate: successRate.toFixed(6),
    avgSlippageBps: avgSlippageBps.toFixed(4),
    avgFillTimeMs: avgFillTimeMs.toFixed(2),
    avgLatencyMs: avgLatencyMs.toFixed(2),
    p50LatencyMs: p50LatencyMs.toFixed(2),
    p95LatencyMs: p95LatencyMs.toFixed(2),
    p99LatencyMs: p99LatencyMs.toFixed(2),
  });

  logger.debug({ mode, period, totalOrders, fillRate: fillRate.toFixed(4) }, "Analytics: metrics computed");
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

/**
 * Get the latest analytics summary for a given mode and period.
 */
export async function getAnalyticsSummary(mode: string, period = "1h"): Promise<ExecutionAnalyticsSummary | null> {
  const rows = await listExecutionMetrics({ mode, period, limit: 1 });
  if (rows.length === 0) return null;

  const r = rows[0]!;
  return {
    mode: r.executionMode as any,
    provider: r.provider ?? "all",
    period: r.period,
    totalOrders: parseInt(r.totalOrders as string),
    totalFills: parseInt(r.totalFills as string),
    totalRejections: parseInt(r.totalRejections as string),
    totalCancellations: parseInt(r.totalCancellations as string),
    fillRate: parseFloat(r.fillRate as string ?? "0"),
    rejectRate: parseFloat(r.rejectRate as string ?? "0"),
    cancelRate: parseFloat(r.cancelRate as string ?? "0"),
    avgSlippageBps: parseFloat(r.avgSlippageBps as string ?? "0"),
    avgFillTimeMs: parseFloat(r.avgFillTimeMs as string ?? "0"),
    avgLatencyMs: parseFloat(r.avgLatencyMs as string ?? "0"),
    p50LatencyMs: parseFloat(r.p50LatencyMs as string ?? "0"),
    p95LatencyMs: parseFloat(r.p95LatencyMs as string ?? "0"),
    p99LatencyMs: parseFloat(r.p99LatencyMs as string ?? "0"),
    successRate: parseFloat(r.successRate as string ?? "0"),
  };
}
