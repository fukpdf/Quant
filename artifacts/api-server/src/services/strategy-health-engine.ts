/**
 * strategy-health-engine.ts — Strategy health computation for Phase 12.
 *
 * Queries backtest_runs, performance_metrics, and paper positions to
 * compute a health score for each known strategy.
 */

import { db } from "@workspace/db";
import { desc, sql, eq, and, gte } from "drizzle-orm";
import {
  backtestRunsTable,
  performanceMetricsTable,
  strategyDefinitionsTable,
  paperPositionsTable,
  paperStrategyAssignmentsTable,
} from "@workspace/db/schema";
import { insertStrategyHealth } from "./ops-db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Helper — score from Sharpe + drawdown
// ---------------------------------------------------------------------------

function computeHealthScore(opts: {
  sharpe: number | null;
  maxDrawdownPct: number | null;
  consecutiveLosses: number;
  dataFreshnessMinutes: number | null;
}): { score: number; status: "healthy" | "warning" | "critical" | "inactive" } {
  const { sharpe, maxDrawdownPct, consecutiveLosses, dataFreshnessMinutes } = opts;

  if (sharpe === null && maxDrawdownPct === null) {
    return { score: 50, status: "inactive" };
  }

  let score = 100;

  // Sharpe-based deduction
  if (sharpe !== null) {
    if (sharpe < 0) score -= 40;
    else if (sharpe < 0.5) score -= 20;
    else if (sharpe < 1.0) score -= 10;
  }

  // Drawdown-based deduction
  if (maxDrawdownPct !== null) {
    const dd = Math.abs(maxDrawdownPct);
    if (dd > 30) score -= 30;
    else if (dd > 20) score -= 20;
    else if (dd > 10) score -= 10;
  }

  // Consecutive loss deduction
  if (consecutiveLosses >= 10) score -= 20;
  else if (consecutiveLosses >= 5) score -= 10;

  // Data freshness deduction
  if (dataFreshnessMinutes !== null && dataFreshnessMinutes > 60) score -= 15;

  score = Math.max(0, Math.min(100, score));
  const status = score >= 80 ? "healthy" : score >= 60 ? "warning" : score >= 30 ? "critical" : "inactive";
  return { score, status };
}

// ---------------------------------------------------------------------------
// Per-strategy health check
// ---------------------------------------------------------------------------

async function checkStrategyHealth(strategyName: string, strategyId: string) {
  try {
    // Latest completed backtest
    const [run] = await db
      .select()
      .from(backtestRunsTable)
      .where(and(eq(backtestRunsTable.strategyName, strategyName), eq(backtestRunsTable.status, "completed")))
      .orderBy(desc(backtestRunsTable.createdAt))
      .limit(1);

    let sharpe: number | null = null;
    let maxDrawdownPct: number | null = null;
    let winRate: number | null = null;
    let backtestCount = 0;

    if (run) {
      const [metrics] = await db
        .select()
        .from(performanceMetricsTable)
        .where(eq(performanceMetricsTable.backtestRunId, run.id))
        .limit(1);

      if (metrics) {
        sharpe = metrics.sharpeRatio ? parseFloat(String(metrics.sharpeRatio)) : null;
        maxDrawdownPct = metrics.maxDrawdown ? parseFloat(String(metrics.maxDrawdown)) : null;
        winRate = metrics.winRate ? parseFloat(String(metrics.winRate)) : null;
      }
    }

    // Count total backtests
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(backtestRunsTable)
      .where(eq(backtestRunsTable.strategyName, strategyName));
    backtestCount = countRow?.count ?? 0;

    // Check active assignment
    const [assignment] = await db
      .select()
      .from(paperStrategyAssignmentsTable)
      .where(and(eq(paperStrategyAssignmentsTable.strategyName, strategyName), eq(paperStrategyAssignmentsTable.isActive, true)))
      .limit(1);
    const isActive = !!assignment;

    const { score, status } = computeHealthScore({
      sharpe,
      maxDrawdownPct,
      consecutiveLosses: 0,
      dataFreshnessMinutes: null,
    });

    await insertStrategyHealth({
      strategyName,
      status,
      healthScore: String(score),
      isActive,
      lastSharpe: sharpe !== null ? sharpe.toFixed(4) : null,
      lastMaxDrawdownPct: maxDrawdownPct !== null ? Math.abs(maxDrawdownPct).toFixed(4) : null,
      lastWinRate: winRate !== null ? winRate.toFixed(4) : null,
      consecutiveLosses: "0",
      currentDrawdownPct: null,
      performanceDrift: null,
      dataFreshnessMinutes: null,
      backtestCount: String(backtestCount),
    });
  } catch (err) {
    logger.warn({ err, strategyName }, "Strategy health check failed");
  }
}

// ---------------------------------------------------------------------------
// Run all
// ---------------------------------------------------------------------------

export async function runStrategyHealthChecks(): Promise<void> {
  try {
    const strategies = await db
      .select({ name: strategyDefinitionsTable.name, id: strategyDefinitionsTable.id })
      .from(strategyDefinitionsTable)
      .where(eq(strategyDefinitionsTable.isActive, true))
      .limit(50);

    await Promise.allSettled(
      strategies.map((s) => checkStrategyHealth(s.name, s.id)),
    );
  } catch (err) {
    logger.warn({ err }, "Failed to run strategy health checks");
  }
}
