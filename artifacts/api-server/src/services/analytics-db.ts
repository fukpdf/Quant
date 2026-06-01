import { db } from "@workspace/db";
import {
  portfolioAnalyticsTable,
  portfolioPerformanceTable,
  portfolioBenchmarksTable,
  portfolioAttributionTable,
  strategyAttributionTable,
  assetAttributionTable,
  portfolioHealthScoresTable,
  portfolioRecommendationsTable,
  allocationSnapshotsTable,
  benchmarkSnapshotsTable,
  performancePeriodsTable,
  analyticsAuditLogTable,
  type InsertPortfolioAnalytics,
  type InsertPortfolioPerformance,
  type InsertPortfolioBenchmark,
  type InsertPortfolioAttribution,
  type InsertStrategyAttribution,
  type InsertAssetAttribution,
  type InsertPortfolioHealthScore,
  type InsertPortfolioRecommendation,
  type InsertAllocationSnapshot,
  type InsertBenchmarkSnapshot,
  type InsertPerformancePeriod,
  type InsertAnalyticsAuditLog,
  type PortfolioAnalytics,
  type PortfolioPerformance,
  type PortfolioBenchmark,
  type PortfolioAttribution,
  type StrategyAttribution,
  type AssetAttribution,
  type PortfolioHealthScore,
  type PortfolioRecommendation,
  type AllocationSnapshot,
  type BenchmarkSnapshot,
  type PerformancePeriod,
  type AnalyticsAuditLog,
} from "@workspace/db";
import { eq, desc, and, lte, gte, isNull, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Portfolio Analytics
// ---------------------------------------------------------------------------

export async function upsertPortfolioAnalytics(data: InsertPortfolioAnalytics): Promise<PortfolioAnalytics> {
  const rows = await db
    .insert(portfolioAnalyticsTable)
    .values({ ...data, snapshotAt: data.snapshotAt ?? new Date() })
    .returning();
  return rows[0]!;
}

export async function getLatestPortfolioAnalytics(accountId: string): Promise<PortfolioAnalytics | undefined> {
  const rows = await db
    .select()
    .from(portfolioAnalyticsTable)
    .where(eq(portfolioAnalyticsTable.accountId, accountId))
    .orderBy(desc(portfolioAnalyticsTable.snapshotAt))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Portfolio Performance
// ---------------------------------------------------------------------------

export async function savePortfolioPerformance(data: InsertPortfolioPerformance): Promise<PortfolioPerformance> {
  const rows = await db
    .insert(portfolioPerformanceTable)
    .values(data)
    .returning();
  return rows[0]!;
}

export async function listPortfolioPerformance(accountId: string, period?: string): Promise<PortfolioPerformance[]> {
  const conditions = [eq(portfolioPerformanceTable.accountId, accountId)];
  if (period) conditions.push(eq(portfolioPerformanceTable.period, period));
  return db
    .select()
    .from(portfolioPerformanceTable)
    .where(and(...conditions))
    .orderBy(desc(portfolioPerformanceTable.periodEnd));
}

export async function getLatestPerformanceByPeriod(accountId: string, period: string): Promise<PortfolioPerformance | undefined> {
  const rows = await db
    .select()
    .from(portfolioPerformanceTable)
    .where(and(
      eq(portfolioPerformanceTable.accountId, accountId),
      eq(portfolioPerformanceTable.period, period),
    ))
    .orderBy(desc(portfolioPerformanceTable.computedAt))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Portfolio Benchmarks
// ---------------------------------------------------------------------------

export async function listBenchmarks(activeOnly = false): Promise<PortfolioBenchmark[]> {
  const q = activeOnly
    ? db.select().from(portfolioBenchmarksTable).where(eq(portfolioBenchmarksTable.isActive, true))
    : db.select().from(portfolioBenchmarksTable);
  return q.orderBy(portfolioBenchmarksTable.createdAt);
}

export async function getBenchmark(id: string): Promise<PortfolioBenchmark | undefined> {
  const rows = await db
    .select()
    .from(portfolioBenchmarksTable)
    .where(eq(portfolioBenchmarksTable.id, id))
    .limit(1);
  return rows[0];
}

export async function getBenchmarkBySymbol(symbol: string): Promise<PortfolioBenchmark | undefined> {
  const rows = await db
    .select()
    .from(portfolioBenchmarksTable)
    .where(eq(portfolioBenchmarksTable.symbol, symbol))
    .limit(1);
  return rows[0];
}

export async function getDefaultBenchmark(): Promise<PortfolioBenchmark | undefined> {
  const rows = await db
    .select()
    .from(portfolioBenchmarksTable)
    .where(and(eq(portfolioBenchmarksTable.isDefault, true), eq(portfolioBenchmarksTable.isActive, true)))
    .limit(1);
  return rows[0];
}

export async function createBenchmark(data: InsertPortfolioBenchmark): Promise<PortfolioBenchmark> {
  const rows = await db
    .insert(portfolioBenchmarksTable)
    .values({ ...data, updatedAt: new Date() })
    .returning();
  return rows[0]!;
}

export async function updateBenchmark(id: string, data: Partial<InsertPortfolioBenchmark>): Promise<PortfolioBenchmark | undefined> {
  const rows = await db
    .update(portfolioBenchmarksTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(portfolioBenchmarksTable.id, id))
    .returning();
  return rows[0];
}

// ---------------------------------------------------------------------------
// Portfolio Attribution
// ---------------------------------------------------------------------------

export async function savePortfolioAttribution(data: InsertPortfolioAttribution): Promise<PortfolioAttribution> {
  const rows = await db.insert(portfolioAttributionTable).values(data).returning();
  return rows[0]!;
}

export async function listPortfolioAttributions(accountId: string, limit = 10): Promise<PortfolioAttribution[]> {
  return db
    .select()
    .from(portfolioAttributionTable)
    .where(eq(portfolioAttributionTable.accountId, accountId))
    .orderBy(desc(portfolioAttributionTable.periodEnd))
    .limit(limit);
}

export async function getLatestPortfolioAttribution(accountId: string): Promise<PortfolioAttribution | undefined> {
  const rows = await db
    .select()
    .from(portfolioAttributionTable)
    .where(eq(portfolioAttributionTable.accountId, accountId))
    .orderBy(desc(portfolioAttributionTable.periodEnd))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Strategy Attribution
// ---------------------------------------------------------------------------

export async function saveStrategyAttributions(rows: InsertStrategyAttribution[]): Promise<StrategyAttribution[]> {
  if (rows.length === 0) return [];
  return db.insert(strategyAttributionTable).values(rows).returning();
}

export async function listStrategyAttributions(accountId: string, attributionId?: string): Promise<StrategyAttribution[]> {
  const conditions = [eq(strategyAttributionTable.accountId, accountId)];
  if (attributionId) conditions.push(eq(strategyAttributionTable.attributionId, attributionId));
  return db
    .select()
    .from(strategyAttributionTable)
    .where(and(...conditions))
    .orderBy(strategyAttributionTable.rank);
}

// ---------------------------------------------------------------------------
// Asset Attribution
// ---------------------------------------------------------------------------

export async function saveAssetAttributions(rows: InsertAssetAttribution[]): Promise<AssetAttribution[]> {
  if (rows.length === 0) return [];
  return db.insert(assetAttributionTable).values(rows).returning();
}

export async function listAssetAttributions(accountId: string, attributionId?: string): Promise<AssetAttribution[]> {
  const conditions = [eq(assetAttributionTable.accountId, accountId)];
  if (attributionId) conditions.push(eq(assetAttributionTable.attributionId, attributionId));
  return db
    .select()
    .from(assetAttributionTable)
    .where(and(...conditions))
    .orderBy(assetAttributionTable.rank);
}

// ---------------------------------------------------------------------------
// Portfolio Health Scores
// ---------------------------------------------------------------------------

export async function saveHealthScore(data: InsertPortfolioHealthScore): Promise<PortfolioHealthScore> {
  const rows = await db.insert(portfolioHealthScoresTable).values(data).returning();
  return rows[0]!;
}

export async function getLatestHealthScore(accountId: string): Promise<PortfolioHealthScore | undefined> {
  const rows = await db
    .select()
    .from(portfolioHealthScoresTable)
    .where(eq(portfolioHealthScoresTable.accountId, accountId))
    .orderBy(desc(portfolioHealthScoresTable.scoredAt))
    .limit(1);
  return rows[0];
}

export async function listHealthScores(accountId: string, limit = 30): Promise<PortfolioHealthScore[]> {
  return db
    .select()
    .from(portfolioHealthScoresTable)
    .where(eq(portfolioHealthScoresTable.accountId, accountId))
    .orderBy(desc(portfolioHealthScoresTable.scoredAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Portfolio Recommendations
// ---------------------------------------------------------------------------

export async function saveRecommendations(data: InsertPortfolioRecommendation[]): Promise<PortfolioRecommendation[]> {
  if (data.length === 0) return [];
  return db.insert(portfolioRecommendationsTable).values(data).returning();
}

export async function listRecommendations(
  accountId: string,
  opts: { unacknowledgedOnly?: boolean; priority?: string } = {},
): Promise<PortfolioRecommendation[]> {
  const conditions = [
    eq(portfolioRecommendationsTable.accountId, accountId),
    eq(portfolioRecommendationsTable.isSuperseded, false),
  ];
  if (opts.unacknowledgedOnly) conditions.push(eq(portfolioRecommendationsTable.isAcknowledged, false));
  if (opts.priority) conditions.push(eq(portfolioRecommendationsTable.priority, opts.priority));
  return db
    .select()
    .from(portfolioRecommendationsTable)
    .where(and(...conditions))
    .orderBy(portfolioRecommendationsTable.sortOrder, desc(portfolioRecommendationsTable.generatedAt));
}

export async function acknowledgeRecommendation(id: string): Promise<PortfolioRecommendation | undefined> {
  const rows = await db
    .update(portfolioRecommendationsTable)
    .set({ isAcknowledged: true, acknowledgedAt: new Date() })
    .where(eq(portfolioRecommendationsTable.id, id))
    .returning();
  return rows[0];
}

export async function supersedePreviousRecommendations(accountId: string, type: string): Promise<void> {
  await db
    .update(portfolioRecommendationsTable)
    .set({ isSuperseded: true })
    .where(and(
      eq(portfolioRecommendationsTable.accountId, accountId),
      eq(portfolioRecommendationsTable.recommendationType, type),
      eq(portfolioRecommendationsTable.isSuperseded, false),
      eq(portfolioRecommendationsTable.isAcknowledged, false),
    ));
}

// ---------------------------------------------------------------------------
// Allocation Snapshots
// ---------------------------------------------------------------------------

export async function saveAllocationSnapshot(data: InsertAllocationSnapshot): Promise<AllocationSnapshot> {
  const rows = await db.insert(allocationSnapshotsTable).values(data).returning();
  return rows[0]!;
}

export async function listAllocationSnapshots(accountId: string, limit = 90): Promise<AllocationSnapshot[]> {
  return db
    .select()
    .from(allocationSnapshotsTable)
    .where(eq(allocationSnapshotsTable.accountId, accountId))
    .orderBy(desc(allocationSnapshotsTable.snapshotAt))
    .limit(limit);
}

export async function getLatestAllocationSnapshot(accountId: string): Promise<AllocationSnapshot | undefined> {
  const rows = await db
    .select()
    .from(allocationSnapshotsTable)
    .where(eq(allocationSnapshotsTable.accountId, accountId))
    .orderBy(desc(allocationSnapshotsTable.snapshotAt))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Benchmark Snapshots
// ---------------------------------------------------------------------------

export async function saveBenchmarkSnapshot(data: InsertBenchmarkSnapshot): Promise<BenchmarkSnapshot> {
  const rows = await db.insert(benchmarkSnapshotsTable).values(data).returning();
  return rows[0]!;
}

export async function listBenchmarkSnapshots(benchmarkId: string, limit = 90): Promise<BenchmarkSnapshot[]> {
  return db
    .select()
    .from(benchmarkSnapshotsTable)
    .where(eq(benchmarkSnapshotsTable.benchmarkId, benchmarkId))
    .orderBy(desc(benchmarkSnapshotsTable.snapshotAt))
    .limit(limit);
}

export async function getLatestBenchmarkSnapshot(benchmarkId: string): Promise<BenchmarkSnapshot | undefined> {
  const rows = await db
    .select()
    .from(benchmarkSnapshotsTable)
    .where(eq(benchmarkSnapshotsTable.benchmarkId, benchmarkId))
    .orderBy(desc(benchmarkSnapshotsTable.snapshotAt))
    .limit(1);
  return rows[0];
}

export async function getBenchmarkSnapshotRange(
  benchmarkId: string,
  from: Date,
  to: Date,
): Promise<BenchmarkSnapshot[]> {
  return db
    .select()
    .from(benchmarkSnapshotsTable)
    .where(and(
      eq(benchmarkSnapshotsTable.benchmarkId, benchmarkId),
      gte(benchmarkSnapshotsTable.snapshotAt, from),
      lte(benchmarkSnapshotsTable.snapshotAt, to),
    ))
    .orderBy(benchmarkSnapshotsTable.snapshotAt);
}

// ---------------------------------------------------------------------------
// Performance Periods
// ---------------------------------------------------------------------------

export async function savePerformancePeriod(data: InsertPerformancePeriod): Promise<PerformancePeriod> {
  const rows = await db.insert(performancePeriodsTable).values(data).returning();
  return rows[0]!;
}

export async function listPerformancePeriods(accountId: string, periodType?: string): Promise<PerformancePeriod[]> {
  const conditions = [eq(performancePeriodsTable.accountId, accountId)];
  if (periodType) conditions.push(eq(performancePeriodsTable.periodType, periodType));
  return db
    .select()
    .from(performancePeriodsTable)
    .where(and(...conditions))
    .orderBy(desc(performancePeriodsTable.periodStart));
}

// ---------------------------------------------------------------------------
// Analytics Audit Log
// ---------------------------------------------------------------------------

export async function appendAnalyticsAuditLog(data: InsertAnalyticsAuditLog): Promise<AnalyticsAuditLog> {
  const rows = await db.insert(analyticsAuditLogTable).values(data).returning();
  return rows[0]!;
}

export async function listAnalyticsAuditLog(opts: {
  accountId?: string;
  action?: string;
  limit?: number;
} = {}): Promise<AnalyticsAuditLog[]> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.accountId) conditions.push(eq(analyticsAuditLogTable.accountId, opts.accountId));
  if (opts.action) conditions.push(eq(analyticsAuditLogTable.action, opts.action));
  const q = conditions.length > 0
    ? db.select().from(analyticsAuditLogTable).where(and(...conditions))
    : db.select().from(analyticsAuditLogTable);
  return q.orderBy(desc(analyticsAuditLogTable.createdAt)).limit(opts.limit ?? 100);
}
