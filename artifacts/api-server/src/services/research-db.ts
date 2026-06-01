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

  return db
    .select()
    .from(backtestRunsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(backtestRunsTable.createdAt))
    .limit(filters.limit ?? 50);
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
    // Phase 4 additions
    calmarRatio: metrics.calmarRatio !== null ? String(metrics.calmarRatio) : null,
    recoveryFactor: metrics.recoveryFactor !== null ? String(metrics.recoveryFactor) : null,
    ulcerIndex: metrics.ulcerIndex !== null ? String(metrics.ulcerIndex) : null,
    marRatio: metrics.marRatio !== null ? String(metrics.marRatio) : null,
    exposureTimePct: metrics.exposureTimePct !== null ? String(metrics.exposureTimePct) : null,
    avgTradeDurationDays:
      metrics.avgTradeDurationDays !== null ? String(metrics.avgTradeDurationDays) : null,
    ulcerPerformanceIndex:
      metrics.ulcerPerformanceIndex !== null ? String(metrics.ulcerPerformanceIndex) : null,
    probabilityOfRuin:
      metrics.probabilityOfRuin !== null ? String(metrics.probabilityOfRuin) : null,
    totalCommission: String(metrics.totalCommission),
    totalSlippage: String(metrics.totalSlippage),
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

export async function listPerformanceResults(
  filters: MetricsFilter = {},
): Promise<Array<{ run: BacktestRun; metrics: PerformanceMetrics }>> {
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

// ---------------------------------------------------------------------------
// Comparison Engine (unchanged from Phase 3)
// ---------------------------------------------------------------------------

export interface MetricComparison {
  label: string;
  values: Record<string, number>;
  winnerId: string | null;
  higherIsBetter: boolean;
}

export interface ComparisonResult {
  runIds: string[];
  comparisons: MetricComparison[];
  overallWinnerId: string | null;
}

export async function compareRuns(runIds: string[]): Promise<ComparisonResult> {
  if (runIds.length < 2) {
    throw new Error("compareRuns requires at least 2 run IDs");
  }

  const metricsRows = await db
    .select()
    .from(performanceMetricsTable)
    .where(inArray(performanceMetricsTable.backtestRunId, runIds));

  if (metricsRows.length < 2) {
    throw new Error("Could not find metrics for at least 2 of the provided run IDs");
  }

  const metricDefs: Array<{
    label: string;
    field: keyof PerformanceMetrics;
    higherIsBetter: boolean;
  }> = [
    { label: "Total Return", field: "totalReturnPct", higherIsBetter: true },
    { label: "Annualized Return", field: "annualizedReturnPct", higherIsBetter: true },
    { label: "Win Rate", field: "winRate", higherIsBetter: true },
    { label: "Profit Factor", field: "profitFactor", higherIsBetter: true },
    { label: "Max Drawdown", field: "maxDrawdownPct", higherIsBetter: false },
    { label: "Sharpe Ratio", field: "sharpeRatio", higherIsBetter: true },
    { label: "Sortino Ratio", field: "sortinoRatio", higherIsBetter: true },
    { label: "Calmar Ratio", field: "calmarRatio", higherIsBetter: true },
    { label: "Ulcer Index", field: "ulcerIndex", higherIsBetter: false },
    { label: "Recovery Factor", field: "recoveryFactor", higherIsBetter: true },
    { label: "Expectancy", field: "expectancy", higherIsBetter: true },
  ];

  const winCounts: Record<string, number> = {};
  for (const m of metricsRows) {
    winCounts[m.backtestRunId] = 0;
  }

  const comparisons: MetricComparison[] = metricDefs.map((def) => {
    const values: Record<string, number> = {};

    for (const m of metricsRows) {
      const raw = m[def.field];
      if (raw !== null && raw !== undefined) {
        values[m.backtestRunId] = parseFloat(String(raw));
      }
    }

    const ids = Object.keys(values);
    if (ids.length < 2) return { label: def.label, values, winnerId: null, higherIsBetter: def.higherIsBetter };

    const sortedIds = [...ids].sort((a, b) =>
      def.higherIsBetter ? values[b]! - values[a]! : values[a]! - values[b]!,
    );

    const winnerId = sortedIds[0]!;
    winCounts[winnerId] = (winCounts[winnerId] ?? 0) + 1;

    return { label: def.label, values, winnerId, higherIsBetter: def.higherIsBetter };
  });

  const overallWinnerId =
    Object.entries(winCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return { runIds, comparisons, overallWinnerId };
}
