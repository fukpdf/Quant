/**
 * intelligence-db.ts — DB access layer for Phase 11 intelligence tables.
 *
 * All reads and writes to the 12 Phase 11 tables go through this module.
 * Uses Drizzle ORM with the shared db instance.
 */

import { db } from "@workspace/db";
import { eq, desc, asc, and, isNull, isNotNull, sql, lt, gte, lte } from "drizzle-orm";
import {
  marketRegimesTable,
  strategyGenerationsTable,
  strategyMutationsTable,
  strategyRankingsTable,
  optimizationRunsTable,
  optimizationResultsTable,
  portfolioAllocationsTable,
  allocationHistoryTable,
  aiResearchJobsTable,
  aiResearchFindingsTable,
  strategyClustersTable,
  strategyLineageTable,
  type InsertMarketRegime,
  type InsertStrategyGeneration,
  type InsertStrategyMutation,
  type InsertStrategyRanking,
  type InsertOptimizationRun,
  type InsertOptimizationResult,
  type InsertPortfolioAllocation,
  type InsertAllocationHistory,
  type InsertAiResearchJob,
  type InsertAiResearchFinding,
  type InsertStrategyCluster,
  type InsertStrategyLineage,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// Market Regimes
// ---------------------------------------------------------------------------

export async function insertMarketRegime(data: InsertMarketRegime) {
  const [row] = await db.insert(marketRegimesTable).values(data).returning();
  return row;
}

export async function getActiveRegime(symbol: string) {
  const [row] = await db
    .select()
    .from(marketRegimesTable)
    .where(and(eq(marketRegimesTable.symbol, symbol), eq(marketRegimesTable.status, "active")))
    .orderBy(desc(marketRegimesTable.detectedAt))
    .limit(1);
  return row ?? null;
}

export async function listMarketRegimes(opts: {
  symbol?: string;
  regimeType?: string;
  status?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.symbol) conditions.push(eq(marketRegimesTable.symbol, opts.symbol));
  if (opts.regimeType) conditions.push(eq(marketRegimesTable.regimeType, opts.regimeType));
  if (opts.status) conditions.push(eq(marketRegimesTable.status, opts.status));

  return db
    .select()
    .from(marketRegimesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(marketRegimesTable.detectedAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function closeRegime(id: string) {
  const [row] = await db
    .update(marketRegimesTable)
    .set({ status: "closed", endAt: new Date(), updatedAt: new Date() })
    .where(eq(marketRegimesTable.id, id))
    .returning();
  return row;
}

export async function getMarketRegimeById(id: string) {
  const [row] = await db
    .select()
    .from(marketRegimesTable)
    .where(eq(marketRegimesTable.id, id))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Strategy Generations
// ---------------------------------------------------------------------------

export async function insertStrategyGeneration(data: InsertStrategyGeneration) {
  const [row] = await db.insert(strategyGenerationsTable).values(data).returning();
  return row;
}

export async function listGenerations(opts: {
  populationId?: string;
  strategyName?: string;
  status?: string;
  limit?: number;
}) {
  const conditions = [];
  if (opts.populationId) conditions.push(eq(strategyGenerationsTable.populationId, opts.populationId));
  if (opts.strategyName) conditions.push(eq(strategyGenerationsTable.strategyName, opts.strategyName));
  if (opts.status) conditions.push(eq(strategyGenerationsTable.status, opts.status));

  return db
    .select()
    .from(strategyGenerationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(strategyGenerationsTable.fitnessScore))
    .limit(opts.limit ?? 100);
}

export async function updateGenerationFitness(
  id: string,
  fitness: {
    fitnessScore: string;
    sharpeRatio: string;
    totalReturn: string;
    maxDrawdown: string;
    tradeCount: number;
    status: string;
    rankInGeneration: number;
    evaluatedAt: Date;
  },
) {
  const [row] = await db
    .update(strategyGenerationsTable)
    .set({ ...fitness, updatedAt: new Date() })
    .where(eq(strategyGenerationsTable.id, id))
    .returning();
  return row;
}

export async function getGenerationById(id: string) {
  const [row] = await db
    .select()
    .from(strategyGenerationsTable)
    .where(eq(strategyGenerationsTable.id, id))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Strategy Mutations
// ---------------------------------------------------------------------------

export async function insertStrategyMutation(data: InsertStrategyMutation) {
  const [row] = await db.insert(strategyMutationsTable).values(data).returning();
  return row;
}

export async function listMutationsForGeneration(generationId: string) {
  return db
    .select()
    .from(strategyMutationsTable)
    .where(eq(strategyMutationsTable.generationId, generationId))
    .orderBy(asc(strategyMutationsTable.createdAt));
}

// ---------------------------------------------------------------------------
// Strategy Rankings
// ---------------------------------------------------------------------------

export async function insertStrategyRanking(data: InsertStrategyRanking) {
  const [row] = await db.insert(strategyRankingsTable).values(data).returning();
  return row;
}

export async function insertStrategyRankingsBatch(rows: InsertStrategyRanking[]) {
  if (rows.length === 0) return [];
  return db.insert(strategyRankingsTable).values(rows).returning();
}

export async function listStrategyRankings(opts: {
  period?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.period) conditions.push(eq(strategyRankingsTable.rankingPeriod, opts.period));
  if (opts.symbol) conditions.push(eq(strategyRankingsTable.symbol, opts.symbol));

  return db
    .select()
    .from(strategyRankingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(strategyRankingsTable.computedAt), asc(strategyRankingsTable.rankPosition))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function getLatestRankingsForPeriod(period: string, limit = 20) {
  const latest = await db
    .select({ computedAt: sql<Date>`max(${strategyRankingsTable.computedAt})` })
    .from(strategyRankingsTable)
    .where(eq(strategyRankingsTable.rankingPeriod, period));

  if (!latest[0]?.computedAt) return [];

  return db
    .select()
    .from(strategyRankingsTable)
    .where(
      and(
        eq(strategyRankingsTable.rankingPeriod, period),
        gte(strategyRankingsTable.computedAt, latest[0].computedAt),
      ),
    )
    .orderBy(asc(strategyRankingsTable.rankPosition))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Optimization Runs
// ---------------------------------------------------------------------------

export async function insertOptimizationRun(data: InsertOptimizationRun) {
  const [row] = await db.insert(optimizationRunsTable).values(data).returning();
  return row;
}

export async function getOptimizationRunById(id: string) {
  const [row] = await db
    .select()
    .from(optimizationRunsTable)
    .where(eq(optimizationRunsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateOptimizationRun(
  id: string,
  patch: Partial<{
    status: string;
    completedIterations: number;
    bestScore: string;
    bestParameters: Record<string, unknown>;
    bestSharpe: string;
    bestTotalReturn: string;
    bestMaxDrawdown: string;
    startedAt: Date;
    completedAt: Date;
    elapsedSeconds: string;
    errorMessage: string;
  }>,
) {
  const [row] = await db
    .update(optimizationRunsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(optimizationRunsTable.id, id))
    .returning();
  return row;
}

export async function listOptimizationRuns(opts: {
  strategyName?: string;
  status?: string;
  method?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.strategyName) conditions.push(eq(optimizationRunsTable.strategyName, opts.strategyName));
  if (opts.status) conditions.push(eq(optimizationRunsTable.status, opts.status));
  if (opts.method) conditions.push(eq(optimizationRunsTable.optimizationMethod, opts.method));

  return db
    .select()
    .from(optimizationRunsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(optimizationRunsTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

// ---------------------------------------------------------------------------
// Optimization Results
// ---------------------------------------------------------------------------

export async function insertOptimizationResult(data: InsertOptimizationResult) {
  const [row] = await db.insert(optimizationResultsTable).values(data).returning();
  return row;
}

export async function insertOptimizationResultsBatch(rows: InsertOptimizationResult[]) {
  if (rows.length === 0) return [];
  return db.insert(optimizationResultsTable).values(rows).returning();
}

export async function listOptimizationResults(runId: string, limit = 100) {
  return db
    .select()
    .from(optimizationResultsTable)
    .where(eq(optimizationResultsTable.runId, runId))
    .orderBy(desc(optimizationResultsTable.score))
    .limit(limit);
}

export async function markResultAsBest(runId: string, resultId: string) {
  await db
    .update(optimizationResultsTable)
    .set({ isBest: false })
    .where(eq(optimizationResultsTable.runId, runId));

  const [row] = await db
    .update(optimizationResultsTable)
    .set({ isBest: true })
    .where(eq(optimizationResultsTable.id, resultId))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Portfolio Allocations
// ---------------------------------------------------------------------------

export async function insertPortfolioAllocation(data: InsertPortfolioAllocation) {
  const [row] = await db.insert(portfolioAllocationsTable).values(data).returning();
  return row;
}

export async function getActiveAllocation() {
  const [row] = await db
    .select()
    .from(portfolioAllocationsTable)
    .where(eq(portfolioAllocationsTable.isActive, true))
    .orderBy(desc(portfolioAllocationsTable.activatedAt))
    .limit(1);
  return row ?? null;
}

export async function activateAllocation(id: string) {
  await db
    .update(portfolioAllocationsTable)
    .set({ isActive: false, status: "archived", updatedAt: new Date() })
    .where(eq(portfolioAllocationsTable.isActive, true));

  const [row] = await db
    .update(portfolioAllocationsTable)
    .set({ isActive: true, status: "active", activatedAt: new Date(), updatedAt: new Date() })
    .where(eq(portfolioAllocationsTable.id, id))
    .returning();
  return row;
}

export async function listPortfolioAllocations(opts: { method?: string; status?: string; limit?: number }) {
  const conditions = [];
  if (opts.method) conditions.push(eq(portfolioAllocationsTable.method, opts.method));
  if (opts.status) conditions.push(eq(portfolioAllocationsTable.status, opts.status));

  return db
    .select()
    .from(portfolioAllocationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(portfolioAllocationsTable.computedAt))
    .limit(opts.limit ?? 50);
}

export async function getPortfolioAllocationById(id: string) {
  const [row] = await db
    .select()
    .from(portfolioAllocationsTable)
    .where(eq(portfolioAllocationsTable.id, id))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Allocation History
// ---------------------------------------------------------------------------

export async function insertAllocationHistory(data: InsertAllocationHistory) {
  const [row] = await db.insert(allocationHistoryTable).values(data).returning();
  return row;
}

export async function listAllocationHistory(allocationId?: string, limit = 50) {
  const q = db
    .select()
    .from(allocationHistoryTable)
    .orderBy(desc(allocationHistoryTable.createdAt))
    .limit(limit);

  if (allocationId) {
    return q.where(eq(allocationHistoryTable.allocationId, allocationId));
  }
  return q;
}

// ---------------------------------------------------------------------------
// AI Research Jobs
// ---------------------------------------------------------------------------

export async function insertAiResearchJob(data: InsertAiResearchJob) {
  const [row] = await db.insert(aiResearchJobsTable).values(data).returning();
  return row;
}

export async function getAiResearchJobById(id: string) {
  const [row] = await db
    .select()
    .from(aiResearchJobsTable)
    .where(eq(aiResearchJobsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateAiResearchJob(
  id: string,
  patch: Partial<{
    status: string;
    providerUsed: string;
    modelUsed: string;
    tokensUsed: string;
    result: Record<string, unknown>;
    rawResponse: string;
    errorMessage: string;
    startedAt: Date;
    completedAt: Date;
  }>,
) {
  const [row] = await db
    .update(aiResearchJobsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(aiResearchJobsTable.id, id))
    .returning();
  return row;
}

export async function listAiResearchJobs(opts: {
  status?: string;
  jobType?: string;
  strategyName?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.status) conditions.push(eq(aiResearchJobsTable.status, opts.status));
  if (opts.jobType) conditions.push(eq(aiResearchJobsTable.jobType, opts.jobType));
  if (opts.strategyName) conditions.push(eq(aiResearchJobsTable.strategyName, opts.strategyName));

  return db
    .select()
    .from(aiResearchJobsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiResearchJobsTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function getPendingResearchJobs(limit = 5) {
  return db
    .select()
    .from(aiResearchJobsTable)
    .where(
      and(
        eq(aiResearchJobsTable.status, "pending"),
        sql`(${aiResearchJobsTable.scheduledAt} IS NULL OR ${aiResearchJobsTable.scheduledAt} <= NOW())`,
      ),
    )
    .orderBy(
      desc(aiResearchJobsTable.priority),
      asc(aiResearchJobsTable.createdAt),
    )
    .limit(limit);
}

// ---------------------------------------------------------------------------
// AI Research Findings
// ---------------------------------------------------------------------------

export async function insertAiResearchFinding(data: InsertAiResearchFinding) {
  const [row] = await db.insert(aiResearchFindingsTable).values(data).returning();
  return row;
}

export async function insertAiResearchFindingsBatch(rows: InsertAiResearchFinding[]) {
  if (rows.length === 0) return [];
  return db.insert(aiResearchFindingsTable).values(rows).returning();
}

export async function listAiResearchFindings(opts: {
  jobId?: string;
  strategyName?: string;
  findingType?: string;
  severity?: string;
  isAcknowledged?: boolean;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.jobId) conditions.push(eq(aiResearchFindingsTable.jobId, opts.jobId));
  if (opts.strategyName) conditions.push(eq(aiResearchFindingsTable.strategyName, opts.strategyName));
  if (opts.findingType) conditions.push(eq(aiResearchFindingsTable.findingType, opts.findingType));
  if (opts.severity) conditions.push(eq(aiResearchFindingsTable.severity, opts.severity));
  if (opts.isAcknowledged !== undefined)
    conditions.push(eq(aiResearchFindingsTable.isAcknowledged, opts.isAcknowledged));

  return db
    .select()
    .from(aiResearchFindingsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiResearchFindingsTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function acknowledgeFinding(id: string) {
  const [row] = await db
    .update(aiResearchFindingsTable)
    .set({ isAcknowledged: true, acknowledgedAt: new Date() })
    .where(eq(aiResearchFindingsTable.id, id))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Strategy Clusters
// ---------------------------------------------------------------------------

export async function insertStrategyCluster(data: InsertStrategyCluster) {
  const [row] = await db.insert(strategyClustersTable).values(data).returning();
  return row;
}

export async function insertStrategyClustersBatch(rows: InsertStrategyCluster[]) {
  if (rows.length === 0) return [];
  return db.insert(strategyClustersTable).values(rows).returning();
}

export async function listStrategyClusters(opts: { method?: string; status?: string; limit?: number }) {
  const conditions = [];
  if (opts.method) conditions.push(eq(strategyClustersTable.clusterMethod, opts.method));
  if (opts.status) conditions.push(eq(strategyClustersTable.status, opts.status));

  return db
    .select()
    .from(strategyClustersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(strategyClustersTable.computedAt))
    .limit(opts.limit ?? 20);
}

export async function archiveOldClusters(method: string) {
  await db
    .update(strategyClustersTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(strategyClustersTable.clusterMethod, method), eq(strategyClustersTable.status, "active")));
}

// ---------------------------------------------------------------------------
// Strategy Lineage
// ---------------------------------------------------------------------------

export async function insertStrategyLineage(data: InsertStrategyLineage) {
  const [row] = await db.insert(strategyLineageTable).values(data).returning();
  return row;
}

export async function getLineageForStrategy(strategyName: string) {
  return db
    .select()
    .from(strategyLineageTable)
    .where(eq(strategyLineageTable.strategyName, strategyName))
    .orderBy(desc(strategyLineageTable.createdAt))
    .limit(1);
}

export async function listStrategyLineage(opts: { lineageType?: string; limit?: number; offset?: number }) {
  const conditions = [];
  if (opts.lineageType) conditions.push(eq(strategyLineageTable.lineageType, opts.lineageType));

  return db
    .select()
    .from(strategyLineageTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(strategyLineageTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}
