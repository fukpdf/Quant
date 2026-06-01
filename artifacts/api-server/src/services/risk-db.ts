import { db } from "@workspace/db";
import {
  riskProfilesTable,
  riskRulesTable,
  riskDecisionsTable,
  riskEventsTable,
  riskViolationsTable,
  portfolioRiskSnapshotsTable,
  strategyRiskScoresTable,
  correlationMatricesTable,
  drawdownEventsTable,
  circuitBreakerEventsTable,
  killSwitchEventsTable,
  riskAuditLogTable,
  type InsertRiskProfile,
  type InsertRiskDecision,
  type InsertRiskEvent,
  type InsertRiskViolation,
  type InsertPortfolioRiskSnapshot,
  type InsertStrategyRiskScore,
  type InsertCorrelationMatrix,
  type InsertDrawdownEvent,
  type InsertCircuitBreakerEvent,
  type InsertKillSwitchEvent,
  type InsertRiskAuditLog,
  type RiskProfile,
  type RiskDecision,
  type RiskEvent,
  type RiskViolation,
  type PortfolioRiskSnapshot,
  type StrategyRiskScore,
  type CorrelationMatrix,
  type DrawdownEvent,
  type CircuitBreakerEvent,
  type KillSwitchEvent,
  type RiskAuditLog,
} from "@workspace/db";
import { eq, desc, and, isNull, lte, gte, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Risk Profiles
// ---------------------------------------------------------------------------

export async function listRiskProfiles(activeOnly = false): Promise<RiskProfile[]> {
  const q = activeOnly
    ? db.select().from(riskProfilesTable).where(eq(riskProfilesTable.isActive, true))
    : db.select().from(riskProfilesTable);
  return q.orderBy(riskProfilesTable.createdAt);
}

export async function getRiskProfile(id: string): Promise<RiskProfile | undefined> {
  const rows = await db
    .select()
    .from(riskProfilesTable)
    .where(eq(riskProfilesTable.id, id))
    .limit(1);
  return rows[0];
}

export async function getDefaultRiskProfile(): Promise<RiskProfile | undefined> {
  const rows = await db
    .select()
    .from(riskProfilesTable)
    .where(and(eq(riskProfilesTable.isDefault, true), eq(riskProfilesTable.isActive, true)))
    .limit(1);
  return rows[0];
}

export async function createRiskProfile(data: InsertRiskProfile): Promise<RiskProfile> {
  const rows = await db
    .insert(riskProfilesTable)
    .values({ ...data, updatedAt: new Date() })
    .returning();
  return rows[0]!;
}

export async function updateRiskProfile(
  id: string,
  data: Partial<InsertRiskProfile>,
): Promise<RiskProfile | undefined> {
  const rows = await db
    .update(riskProfilesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(riskProfilesTable.id, id))
    .returning();
  return rows[0];
}

// ---------------------------------------------------------------------------
// Risk Decisions
// ---------------------------------------------------------------------------

export async function createRiskDecision(data: InsertRiskDecision): Promise<RiskDecision> {
  const rows = await db.insert(riskDecisionsTable).values(data).returning();
  return rows[0]!;
}

export async function listRiskDecisions(opts: {
  accountId?: string;
  decision?: string;
  strategyName?: string;
  limit?: number;
}): Promise<RiskDecision[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(riskDecisionsTable.accountId, opts.accountId));
  if (opts.decision) conditions.push(eq(riskDecisionsTable.decision, opts.decision));
  if (opts.strategyName) conditions.push(eq(riskDecisionsTable.strategyName, opts.strategyName));

  return db
    .select()
    .from(riskDecisionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riskDecisionsTable.evaluatedAt))
    .limit(opts.limit ?? 100);
}

// ---------------------------------------------------------------------------
// Risk Events
// ---------------------------------------------------------------------------

export async function createRiskEvent(data: InsertRiskEvent): Promise<RiskEvent> {
  const rows = await db.insert(riskEventsTable).values(data).returning();
  return rows[0]!;
}

export async function listRiskEvents(opts: {
  accountId?: string;
  severity?: string;
  resolved?: boolean;
  limit?: number;
}): Promise<RiskEvent[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(riskEventsTable.accountId, opts.accountId));
  if (opts.severity) conditions.push(eq(riskEventsTable.severity, opts.severity));
  if (opts.resolved !== undefined) conditions.push(eq(riskEventsTable.resolved, opts.resolved));

  return db
    .select()
    .from(riskEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riskEventsTable.createdAt))
    .limit(opts.limit ?? 100);
}

export async function resolveRiskEvent(id: string): Promise<void> {
  await db
    .update(riskEventsTable)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(riskEventsTable.id, id));
}

// ---------------------------------------------------------------------------
// Risk Violations
// ---------------------------------------------------------------------------

export async function createRiskViolation(data: InsertRiskViolation): Promise<RiskViolation> {
  const rows = await db.insert(riskViolationsTable).values(data).returning();
  return rows[0]!;
}

export async function listRiskViolations(opts: {
  accountId?: string;
  ruleType?: string;
  severity?: string;
  limit?: number;
}): Promise<RiskViolation[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(riskViolationsTable.accountId, opts.accountId));
  if (opts.ruleType) conditions.push(eq(riskViolationsTable.ruleType, opts.ruleType));
  if (opts.severity) conditions.push(eq(riskViolationsTable.severity, opts.severity));

  return db
    .select()
    .from(riskViolationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riskViolationsTable.createdAt))
    .limit(opts.limit ?? 100);
}

// ---------------------------------------------------------------------------
// Portfolio Risk Snapshots
// ---------------------------------------------------------------------------

export async function createPortfolioRiskSnapshot(
  data: InsertPortfolioRiskSnapshot,
): Promise<PortfolioRiskSnapshot> {
  const rows = await db.insert(portfolioRiskSnapshotsTable).values(data).returning();
  return rows[0]!;
}

export async function listPortfolioRiskSnapshots(
  accountId: string,
  limit = 90,
): Promise<PortfolioRiskSnapshot[]> {
  return db
    .select()
    .from(portfolioRiskSnapshotsTable)
    .where(eq(portfolioRiskSnapshotsTable.accountId, accountId))
    .orderBy(desc(portfolioRiskSnapshotsTable.snapshotAt))
    .limit(limit);
}

export async function getLatestPortfolioRiskSnapshot(
  accountId: string,
): Promise<PortfolioRiskSnapshot | undefined> {
  const rows = await db
    .select()
    .from(portfolioRiskSnapshotsTable)
    .where(eq(portfolioRiskSnapshotsTable.accountId, accountId))
    .orderBy(desc(portfolioRiskSnapshotsTable.snapshotAt))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Strategy Risk Scores
// ---------------------------------------------------------------------------

export async function upsertStrategyRiskScore(
  data: InsertStrategyRiskScore,
): Promise<StrategyRiskScore> {
  const rows = await db.insert(strategyRiskScoresTable).values(data).returning();
  return rows[0]!;
}

export async function listStrategyRiskScores(): Promise<StrategyRiskScore[]> {
  // Return only the most recent score per strategy name
  return db
    .selectDistinctOn([strategyRiskScoresTable.strategyName])
    .from(strategyRiskScoresTable)
    .orderBy(
      strategyRiskScoresTable.strategyName,
      desc(strategyRiskScoresTable.calculatedAt),
    );
}

export async function getLatestStrategyRiskScore(
  strategyName: string,
): Promise<StrategyRiskScore | undefined> {
  const rows = await db
    .select()
    .from(strategyRiskScoresTable)
    .where(eq(strategyRiskScoresTable.strategyName, strategyName))
    .orderBy(desc(strategyRiskScoresTable.calculatedAt))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Correlation Matrices
// ---------------------------------------------------------------------------

export async function createCorrelationMatrix(
  data: InsertCorrelationMatrix,
): Promise<CorrelationMatrix> {
  const rows = await db.insert(correlationMatricesTable).values(data).returning();
  return rows[0]!;
}

export async function getLatestCorrelationMatrix(
  windowDays = 30,
): Promise<CorrelationMatrix | undefined> {
  const rows = await db
    .select()
    .from(correlationMatricesTable)
    .where(eq(correlationMatricesTable.windowDays, windowDays))
    .orderBy(desc(correlationMatricesTable.calculatedAt))
    .limit(1);
  return rows[0];
}

export async function listCorrelationMatrices(limit = 30): Promise<CorrelationMatrix[]> {
  return db
    .select()
    .from(correlationMatricesTable)
    .orderBy(desc(correlationMatricesTable.calculatedAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Drawdown Events
// ---------------------------------------------------------------------------

export async function createDrawdownEvent(data: InsertDrawdownEvent): Promise<DrawdownEvent> {
  const rows = await db.insert(drawdownEventsTable).values(data).returning();
  return rows[0]!;
}

export async function listDrawdownEvents(opts: {
  accountId?: string;
  resolved?: boolean;
  limit?: number;
}): Promise<DrawdownEvent[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(drawdownEventsTable.accountId, opts.accountId));
  if (opts.resolved !== undefined) conditions.push(eq(drawdownEventsTable.resolved, opts.resolved));

  return db
    .select()
    .from(drawdownEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(drawdownEventsTable.createdAt))
    .limit(opts.limit ?? 100);
}

export async function resolveDrawdownEvent(id: string): Promise<void> {
  await db
    .update(drawdownEventsTable)
    .set({ resolved: true, resolvedAt: new Date() })
    .where(eq(drawdownEventsTable.id, id));
}

// ---------------------------------------------------------------------------
// Circuit Breaker Events
// ---------------------------------------------------------------------------

export async function createCircuitBreakerEvent(
  data: InsertCircuitBreakerEvent,
): Promise<CircuitBreakerEvent> {
  const rows = await db.insert(circuitBreakerEventsTable).values(data).returning();
  return rows[0]!;
}

export async function listCircuitBreakerEvents(opts: {
  breakerType?: string;
  state?: string;
  accountId?: string;
  limit?: number;
}): Promise<CircuitBreakerEvent[]> {
  const conditions = [];
  if (opts.breakerType) conditions.push(eq(circuitBreakerEventsTable.breakerType, opts.breakerType));
  if (opts.state) conditions.push(eq(circuitBreakerEventsTable.state, opts.state));
  if (opts.accountId) conditions.push(eq(circuitBreakerEventsTable.accountId, opts.accountId));

  return db
    .select()
    .from(circuitBreakerEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(circuitBreakerEventsTable.createdAt))
    .limit(opts.limit ?? 100);
}

// ---------------------------------------------------------------------------
// Kill Switch Events
// ---------------------------------------------------------------------------

export async function createKillSwitchEvent(
  data: InsertKillSwitchEvent,
): Promise<KillSwitchEvent> {
  const rows = await db.insert(killSwitchEventsTable).values(data).returning();
  return rows[0]!;
}

export async function listKillSwitchEvents(limit = 100): Promise<KillSwitchEvent[]> {
  return db
    .select()
    .from(killSwitchEventsTable)
    .orderBy(desc(killSwitchEventsTable.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Risk Audit Log
// ---------------------------------------------------------------------------

export async function appendAuditLog(data: InsertRiskAuditLog): Promise<RiskAuditLog> {
  const rows = await db.insert(riskAuditLogTable).values(data).returning();
  return rows[0]!;
}

export async function listAuditLog(opts: {
  action?: string;
  entityType?: string;
  limit?: number;
}): Promise<RiskAuditLog[]> {
  const conditions = [];
  if (opts.action) conditions.push(eq(riskAuditLogTable.action, opts.action));
  if (opts.entityType) conditions.push(eq(riskAuditLogTable.entityType, opts.entityType));

  return db
    .select()
    .from(riskAuditLogTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riskAuditLogTable.createdAt))
    .limit(opts.limit ?? 200);
}

// ---------------------------------------------------------------------------
// Helper: count rejected decisions for an account today
// ---------------------------------------------------------------------------

export async function countRejectedDecisionsToday(accountId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(riskDecisionsTable)
    .where(
      and(
        eq(riskDecisionsTable.accountId, accountId),
        eq(riskDecisionsTable.decision, "rejected"),
        gte(riskDecisionsTable.evaluatedAt, startOfDay),
      ),
    );
  return rows[0]?.count ?? 0;
}
