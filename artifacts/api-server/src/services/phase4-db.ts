/**
 * Data access layer for Phase 4 tables.
 * Covers: portfolio_backtests, walk_forward_runs, monte_carlo_runs,
 *         validation_results, trade_cost_models, position_sizing_profiles,
 *         research_snapshots.
 */

import { eq, desc, and, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  portfolioBacktestsTable,
  walkForwardRunsTable,
  monteCarloRunsTable,
  validationResultsTable,
  tradeCostModelsTable,
  positionSizingProfilesTable,
  researchSnapshotsTable,
  backtestRunsTable,
  performanceMetricsTable,
  type InsertPortfolioBacktest,
  type PortfolioBacktest,
  type InsertWalkForwardRun,
  type WalkForwardRun,
  type InsertMonteCarloRun,
  type MonteCarloRun,
  type InsertValidationResult,
  type ValidationResult,
  type TradeCostModel,
  type PositionSizingProfile,
  type InsertResearchSnapshot,
  type ResearchSnapshot,
  type BacktestRun,
  type PerformanceMetrics,
} from "@workspace/db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Portfolio Backtests
// ---------------------------------------------------------------------------

export async function createPortfolioBacktest(
  data: Omit<InsertPortfolioBacktest, "status" | "candlesProcessed" | "startedAt">,
): Promise<PortfolioBacktest> {
  const [row] = await db
    .insert(portfolioBacktestsTable)
    .values({ ...data, status: "pending", candlesProcessed: 0, startedAt: new Date() })
    .returning();
  if (!row) throw new Error("Failed to create portfolio backtest");
  return row;
}

export async function updatePortfolioBacktestStatus(
  id: string,
  status: "running" | "completed" | "failed",
  extra?: {
    candlesProcessed?: number;
    errorMessage?: string;
    completedAt?: Date;
    portfolioMetrics?: string;
  },
): Promise<void> {
  await db
    .update(portfolioBacktestsTable)
    .set({
      status,
      ...(extra?.candlesProcessed !== undefined && { candlesProcessed: extra.candlesProcessed }),
      ...(extra?.errorMessage !== undefined && { errorMessage: extra.errorMessage }),
      ...(extra?.completedAt !== undefined && { completedAt: extra.completedAt }),
      ...(extra?.portfolioMetrics !== undefined && { portfolioMetrics: extra.portfolioMetrics }),
    })
    .where(eq(portfolioBacktestsTable.id, id));
}

export async function getPortfolioBacktest(id: string): Promise<PortfolioBacktest | null> {
  const [row] = await db
    .select()
    .from(portfolioBacktestsTable)
    .where(eq(portfolioBacktestsTable.id, id));
  return row ?? null;
}

export async function listPortfolioBacktests(
  filters: { strategyName?: string; status?: string; limit?: number } = {},
): Promise<PortfolioBacktest[]> {
  const conditions = [];
  if (filters.strategyName)
    conditions.push(eq(portfolioBacktestsTable.strategyName, filters.strategyName));
  if (filters.status) conditions.push(eq(portfolioBacktestsTable.status, filters.status));

  return db
    .select()
    .from(portfolioBacktestsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(portfolioBacktestsTable.createdAt))
    .limit(filters.limit ?? 50);
}

// ---------------------------------------------------------------------------
// Walk-Forward Runs
// ---------------------------------------------------------------------------

export async function createWalkForwardRun(
  data: Omit<InsertWalkForwardRun, "status" | "startedAt">,
): Promise<WalkForwardRun> {
  const [row] = await db
    .insert(walkForwardRunsTable)
    .values({ ...data, status: "pending", startedAt: new Date() })
    .returning();
  if (!row) throw new Error("Failed to create walk-forward run");
  return row;
}

export async function updateWalkForwardRun(
  id: string,
  update: Partial<WalkForwardRun>,
): Promise<void> {
  await db.update(walkForwardRunsTable).set(update).where(eq(walkForwardRunsTable.id, id));
}

export async function getWalkForwardRun(id: string): Promise<WalkForwardRun | null> {
  const [row] = await db
    .select()
    .from(walkForwardRunsTable)
    .where(eq(walkForwardRunsTable.id, id));
  return row ?? null;
}

export async function listWalkForwardRuns(
  filters: { strategyName?: string; status?: string; limit?: number } = {},
): Promise<WalkForwardRun[]> {
  const conditions = [];
  if (filters.strategyName)
    conditions.push(eq(walkForwardRunsTable.strategyName, filters.strategyName));
  if (filters.status) conditions.push(eq(walkForwardRunsTable.status, filters.status));

  return db
    .select()
    .from(walkForwardRunsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(walkForwardRunsTable.createdAt))
    .limit(filters.limit ?? 50);
}

// ---------------------------------------------------------------------------
// Monte Carlo Runs
// ---------------------------------------------------------------------------

export async function createMonteCarloRun(
  backtestRunId: string,
  simulations: number,
  seed?: number,
): Promise<MonteCarloRun> {
  const [row] = await db
    .insert(monteCarloRunsTable)
    .values({
      backtestRunId,
      simulations,
      seed: seed ?? null,
      status: "pending",
      startedAt: new Date(),
    })
    .returning();
  if (!row) throw new Error("Failed to create Monte Carlo run");
  return row;
}

export async function updateMonteCarloRun(
  id: string,
  update: Partial<MonteCarloRun>,
): Promise<void> {
  await db.update(monteCarloRunsTable).set(update).where(eq(monteCarloRunsTable.id, id));
}

export async function getMonteCarloRun(id: string): Promise<MonteCarloRun | null> {
  const [row] = await db
    .select()
    .from(monteCarloRunsTable)
    .where(eq(monteCarloRunsTable.id, id));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Validation Results
// ---------------------------------------------------------------------------

export async function saveValidationResult(
  data: Omit<InsertValidationResult, "createdAt" | "generatedAt">,
): Promise<ValidationResult> {
  const [row] = await db
    .insert(validationResultsTable)
    .values({ ...data, generatedAt: new Date() })
    .returning();
  if (!row) throw new Error("Failed to save validation result");
  return row;
}

export async function getValidationResultForRun(
  backtestRunId: string,
): Promise<ValidationResult | null> {
  const [row] = await db
    .select()
    .from(validationResultsTable)
    .where(eq(validationResultsTable.backtestRunId, backtestRunId))
    .orderBy(desc(validationResultsTable.generatedAt))
    .limit(1);
  return row ?? null;
}

export async function getValidationResultForWalkForward(
  walkForwardRunId: string,
): Promise<ValidationResult | null> {
  const [row] = await db
    .select()
    .from(validationResultsTable)
    .where(eq(validationResultsTable.walkForwardRunId, walkForwardRunId))
    .orderBy(desc(validationResultsTable.generatedAt))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Cost Models
// ---------------------------------------------------------------------------

export async function listCostModels(): Promise<TradeCostModel[]> {
  return db
    .select()
    .from(tradeCostModelsTable)
    .where(eq(tradeCostModelsTable.isActive, true))
    .orderBy(tradeCostModelsTable.name);
}

export async function getCostModel(id: string): Promise<TradeCostModel | null> {
  const [row] = await db
    .select()
    .from(tradeCostModelsTable)
    .where(eq(tradeCostModelsTable.id, id));
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Position Sizing Profiles
// ---------------------------------------------------------------------------

export async function listPositionSizingProfiles(): Promise<PositionSizingProfile[]> {
  return db
    .select()
    .from(positionSizingProfilesTable)
    .where(eq(positionSizingProfilesTable.isActive, true))
    .orderBy(positionSizingProfilesTable.name);
}

// ---------------------------------------------------------------------------
// Research Snapshots
// ---------------------------------------------------------------------------

export async function saveResearchSnapshot(
  data: Omit<InsertResearchSnapshot, "createdAt" | "updatedAt">,
): Promise<ResearchSnapshot> {
  const [row] = await db
    .insert(researchSnapshotsTable)
    .values({ ...data, updatedAt: new Date() })
    .returning();
  if (!row) throw new Error("Failed to save research snapshot");
  return row;
}

export async function listResearchSnapshots(
  snapshotType?: string,
  limit = 50,
): Promise<ResearchSnapshot[]> {
  const condition = snapshotType
    ? eq(researchSnapshotsTable.snapshotType, snapshotType)
    : undefined;
  return db
    .select()
    .from(researchSnapshotsTable)
    .where(condition)
    .orderBy(desc(researchSnapshotsTable.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Rankings — joins backtest_runs + performance_metrics, sorted by Sharpe
// ---------------------------------------------------------------------------

export interface RankedResult {
  run: BacktestRun;
  metrics: PerformanceMetrics;
  rank: number;
}

export async function getRankings(limit = 20): Promise<RankedResult[]> {
  const runs = await db
    .select()
    .from(backtestRunsTable)
    .where(eq(backtestRunsTable.status, "completed"))
    .orderBy(desc(backtestRunsTable.createdAt))
    .limit(limit * 3);

  if (runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const metrics = await db
    .select()
    .from(performanceMetricsTable)
    .where(inArray(performanceMetricsTable.backtestRunId, runIds));

  const metricsMap = new Map(metrics.map((m) => [m.backtestRunId, m]));

  const paired = runs
    .map((run) => {
      const m = metricsMap.get(run.id);
      return m ? { run, metrics: m } : null;
    })
    .filter((x): x is { run: BacktestRun; metrics: PerformanceMetrics } => x !== null);

  // Sort by Sharpe ratio descending (nulls last), then total return descending
  paired.sort((a, b) => {
    const aS = a.metrics.sharpeRatio !== null ? parseFloat(String(a.metrics.sharpeRatio)) : -Infinity;
    const bS = b.metrics.sharpeRatio !== null ? parseFloat(String(b.metrics.sharpeRatio)) : -Infinity;
    if (bS !== aS) return bS - aS;
    return (
      parseFloat(String(b.metrics.totalReturnPct)) -
      parseFloat(String(a.metrics.totalReturnPct))
    );
  });

  return paired.slice(0, limit).map((item, idx) => ({
    run: item.run,
    metrics: item.metrics,
    rank: idx + 1,
  }));
}
