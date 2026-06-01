import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  backtestRunsTable,
  backtestTradesTable,
  performanceMetricsTable,
  strategyDefinitionsTable,
  strategyVersionsTable,
  type InsertBacktestRun,
  type InsertBacktestTrade,
  type InsertPerformanceMetrics,
  type BacktestRun,
  type BacktestTrade,
  type PerformanceMetrics,
  type StrategyDefinition,
  type InsertStrategyDefinition,
  type InsertStrategyVersion,
} from "@workspace/db";
import type { SimulatedTrade } from "../strategies/types";
import type { ComputedMetrics } from "./performance-calculator";
import { getAllStrategies } from "../strategies/registry";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Strategy Definitions
// ---------------------------------------------------------------------------

/**
 * Seed strategy_definitions from the in-process registry.
 * Idempotent — safe to call on every startup.
 */
export async function seedStrategyDefinitions(): Promise<void> {
  const strategies = getAllStrategies();

  for (const strategy of strategies) {
    const parameterSchema = JSON.stringify(strategy.parameterSchema);
    await db
      .insert(strategyDefinitionsTable)
      .values({
        name: strategy.name,
        displayName: strategy.displayName,
        description: strategy.description ?? null,
        parameterSchema,
        currentVersion: 1,
        isActive: true,
      } satisfies InsertStrategyDefinition)
      .onConflictDoUpdate({
        target: strategyDefinitionsTable.name,
        set: {
          displayName: strategy.displayName,
          description: strategy.description ?? null,
          parameterSchema,
          isActive: true,
          updatedAt: new Date(),
        },
      });
  }

  logger.info({ count: strategies.length }, "Seeded strategy definitions");
}

export async function listStrategyDefinitions(): Promise<StrategyDefinition[]> {
  return db.select().from(strategyDefinitionsTable).where(
    eq(strategyDefinitionsTable.isActive, true),
  );
}

// ---------------------------------------------------------------------------
// Backtest Runs
// ---------------------------------------------------------------------------

export async function createBacktestRun(
  data: Omit<InsertBacktestRun, "status" | "candlesProcessed" | "startedAt">,
): Promise<BacktestRun> {
  const [row] = await db
    .insert(backtestRunsTable)
    .values({
      ...data,
      status: "pending",
      candlesProcessed: 0,
      startedAt: new Date(),
    })
    .returning();

  if (!row) throw new Error("Failed to create backtest run");
  return row;
}

export async function updateBacktestRunStatus(
  id: string,
  status: "running" | "completed" | "failed",
  extra?: { candlesProcessed?: number; errorMessage?: string; completedAt?: Date },
): Promise<void> {
  await db
    .update(backtestRunsTable)
    .set({
      status,
      ...(extra?.candlesProcessed !== undefined && {
        candlesProcessed: extra.candlesProcessed,
      }),
      ...(extra?.errorMessage !== undefined && { errorMessage: extra.errorMessage }),
      ...(extra?.completedAt !== undefined && { completedAt: extra.completedAt }),
    })
    .where(eq(backtestRunsTable.id, id));
}

export async function getBacktestRun(id: string): Promise<BacktestRun | null> {
  const [row] = await db
    .select()
    .from(backtestRunsTable)
    .where(eq(backtestRunsTable.id, id));
  return row ?? null;
}

export interface BacktestRunFilter {
  strategyName?: string;
  symbol?: string;
  status?: string;
  limit?: number;
}

export async function listBacktestRuns(filters: BacktestRunFilter = {}): Promise<BacktestRun[]> {
  const conditions = [];

  if (filters.strategyName) {
    conditions.push(eq(backtestRunsTable.strategyName, filters.strategyName));
  }
  if (filters.symbol) {
    conditions.push(eq(backtestRunsTable.symbol, filters.symbol));
  }
  if (filters.status) {
    conditions.push(eq(backtestRunsTable.status, filters.status));
  }

  const query = db
    .select()
    .from(backtestRunsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(backtestRunsTable.createdAt))
    .limit(filters.limit ?? 50);

  return query;
}

// ---------------------------------------------------------------------------
// Backtest Trades
// ---------------------------------------------------------------------------

export async function saveBacktestTrades(
  backtestRunId: string,
  trades: SimulatedTrade[],
): Promise<void> {
  if (trades.length === 0) return;

  const rows: InsertBacktestTrade[] = trades.map((t) => ({
    backtestRunId,
    side: t.side,
    entryTime: t.entryTime,
    exitTime: t.exitTime ?? null,
    entryPrice: String(t.entryPrice),
    exitPrice: t.exitPrice !== null ? String(t.exitPrice) : null,
    quantity: String(t.quantity),
    pnl: t.pnl !== null ? String(t.pnl) : null,
    pnlPct: t.pnlPct !== null ? String(t.pnlPct) : null,
    entrySignal: t.entrySignal,
    exitSignal: t.exitSignal ?? null,
    candleIndexEntry: t.candleIndexEntry,
    candleIndexExit: t.candleIndexExit ?? null,
  }));

  // Insert in batches
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(backtestTradesTable).values(rows.slice(i, i + BATCH));
  }
}

export async function getTradesForRun(backtestRunId: string): Promise<BacktestTrade[]> {
  return db
    .select()
    .from(backtestTradesTable)
    .where(eq(backtestTradesTable.backtestRunId, backtestRunId))
    .orderBy(backtestTradesTable.entryTime);
}

// ---------------------------------------------------------------------------
// Performance Metrics
// ---------------------------------------------------------------------------

export async function savePerformanceMetrics(
  backtestRunId: string,
  metrics: ComputedMetrics,
): Promise<void> {
  const row: InsertPerformanceMetrics = {
    backtestRunId,
    totalReturnPct: String(metrics.totalReturnPct),
    annualizedReturnPct:
      metrics.annualizedReturnPct !== null ? String(metrics.annualizedReturnPct) : null,
    winRate: String(metrics.winRate),
    profitFactor: metrics.profitFactor !== null ? String(metrics.profitFactor) : null,
    avgWinPct: metrics.avgWinPct !== null ? String(metrics.avgWinPct) : null,
    avgLossPct: metrics.avgLossPct !== null ? String(metrics.avgLossPct) : null,
    maxDrawdownPct: String(metrics.maxDrawdownPct),
    sharpeRatio: metrics.sharpeRatio !== null ? String(metrics.sharpeRatio) : null,
    sortinoRatio: metrics.sortinoRatio !== null ? String(metrics.sortinoRatio) : null,
    totalTrades: metrics.totalTrades,
    winningTrades: metrics.winningTrades,
    losingTrades: metrics.losingTrades,
    expectancy: metrics.expectancy !== null ? String(metrics.expectancy) : null,
  };

  await db
    .insert(performanceMetricsTable)
    .values(row)
    .onConflictDoUpdate({
      target: performanceMetricsTable.backtestRunId,
      set: { ...row },
    });
}

export async function getMetricsForRun(
  backtestRunId: string,
): Promise<PerformanceMetrics | null> {
  const [row] = await db
    .select()
    .from(performanceMetricsTable)
    .where(eq(performanceMetricsTable.backtestRunId, backtestRunId));
  return row ?? null;
}

export interface MetricsFilter {
  strategyName?: string;
  limit?: number;
}

/** Returns performance metrics joined with their backtest run metadata */
export async function listPerformanceResults(
  filters: MetricsFilter = {},
): Promise<Array<{ run: BacktestRun; metrics: PerformanceMetrics }>> {
  // Get completed runs first, then fetch metrics
  const runFilters: BacktestRunFilter = {
    status: "completed",
    limit: filters.limit ?? 50,
    ...(filters.strategyName && { strategyName: filters.strategyName }),
  };

  const runs = await listBacktestRuns(runFilters);
  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const metrics = await db
    .select()
    .from(performanceMetricsTable)
    .where(inArray(performanceMetricsTable.backtestRunId, runIds));

  const metricsMap = new Map(metrics.map((m) => [m.backtestRunId, m]));

  return runs
    .map((run) => {
      const m = metricsMap.get(run.id);
      return m ? { run, metrics: m } : null;
    })
    .filter((x): x is { run: BacktestRun; metrics: PerformanceMetrics } => x !== null);
}
