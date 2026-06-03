import { db } from "@workspace/db";
import {
  executionAccountsTable,
  executionOrdersTable,
  executionOrderEventsTable,
  executionRoutesTable,
  executionFillsTable,
  executionPositionsTable,
  executionSessionsTable,
  executionRejectionsTable,
  executionLatencyTable,
  executionMetricsTable,
  executionRecoveryTable,
  executionAuditLogTable,
  type InsertExecutionAccount,
  type InsertExecutionOrder,
  type InsertExecutionOrderEvent,
  type InsertExecutionRoute,
  type InsertExecutionFill,
  type InsertExecutionPosition,
  type InsertExecutionSession,
  type InsertExecutionRejection,
  type InsertExecutionLatency,
  type InsertExecutionMetric,
  type InsertExecutionRecovery,
  type InsertExecutionAuditLog,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Execution Accounts
// ---------------------------------------------------------------------------

export async function insertExecutionAccount(data: InsertExecutionAccount) {
  const [row] = await db.insert(executionAccountsTable).values(data).returning();
  return row!;
}

export async function getExecutionAccount(id: string) {
  const [row] = await db
    .select()
    .from(executionAccountsTable)
    .where(eq(executionAccountsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function listExecutionAccounts(mode?: string) {
  const q = db.select().from(executionAccountsTable);
  if (mode) {
    return q.where(eq(executionAccountsTable.executionMode, mode)).orderBy(desc(executionAccountsTable.createdAt));
  }
  return q.orderBy(desc(executionAccountsTable.createdAt));
}

export async function updateExecutionAccountBalance(id: string, balance: string) {
  await db
    .update(executionAccountsTable)
    .set({ balance, updatedAt: new Date() })
    .where(eq(executionAccountsTable.id, id));
}

export async function upsertDefaultExecutionAccount(mode: string): Promise<string> {
  const existing = await db
    .select()
    .from(executionAccountsTable)
    .where(and(eq(executionAccountsTable.executionMode, mode), eq(executionAccountsTable.isActive, true)))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [created] = await db
    .insert(executionAccountsTable)
    .values({ name: `Default ${mode} account`, executionMode: mode, balance: "100000", currency: "USDT" })
    .returning();
  return created!.id;
}

// ---------------------------------------------------------------------------
// Execution Orders
// ---------------------------------------------------------------------------

export async function insertExecutionOrder(data: InsertExecutionOrder) {
  const [row] = await db.insert(executionOrdersTable).values(data).returning();
  return row!;
}

export async function getExecutionOrder(id: string) {
  const [row] = await db
    .select()
    .from(executionOrdersTable)
    .where(eq(executionOrdersTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateExecutionOrderStatus(
  id: string,
  status: string,
  extra: Partial<{
    filledQuantity: string;
    remainingQuantity: string;
    avgFillPrice: string;
    externalOrderId: string;
    routedTo: string;
    riskResult: string;
    riskDecisionId: string;
    rejectReason: string;
    rejectStage: string;
    commission: string;
    totalLatencyMs: string;
    submittedAt: Date;
    routedAt: Date;
    acknowledgedAt: Date;
    filledAt: Date;
    cancelledAt: Date;
    rejectedAt: Date;
  }> = {},
) {
  await db
    .update(executionOrdersTable)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(executionOrdersTable.id, id));
}

export async function listExecutionOrders(opts: {
  accountId?: string;
  status?: string | string[];
  symbol?: string;
  mode?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(executionOrdersTable.accountId, opts.accountId));
  if (opts.status) {
    if (Array.isArray(opts.status)) {
      conditions.push(inArray(executionOrdersTable.status, opts.status));
    } else {
      conditions.push(eq(executionOrdersTable.status, opts.status));
    }
  }
  if (opts.symbol) conditions.push(eq(executionOrdersTable.symbol, opts.symbol));
  if (opts.mode) conditions.push(eq(executionOrdersTable.executionMode, opts.mode));

  const q = db
    .select()
    .from(executionOrdersTable)
    .orderBy(desc(executionOrdersTable.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);

  if (conditions.length > 0) {
    return q.where(and(...conditions));
  }
  return q;
}

// ---------------------------------------------------------------------------
// Execution Order Events
// ---------------------------------------------------------------------------

export async function insertExecutionOrderEvent(data: InsertExecutionOrderEvent) {
  const [row] = await db.insert(executionOrderEventsTable).values(data).returning();
  return row!;
}

export async function getOrderEvents(orderId: string) {
  return db
    .select()
    .from(executionOrderEventsTable)
    .where(eq(executionOrderEventsTable.orderId, orderId))
    .orderBy(executionOrderEventsTable.createdAt);
}

// ---------------------------------------------------------------------------
// Execution Routes
// ---------------------------------------------------------------------------

export async function insertExecutionRoute(data: InsertExecutionRoute) {
  const [row] = await db.insert(executionRoutesTable).values(data).returning();
  return row!;
}

export async function updateExecutionRoute(
  id: string,
  update: Partial<{ status: string; ackLatencyMs: string; externalOrderId: string; errorMessage: string; acknowledgedAt: Date }>,
) {
  await db.update(executionRoutesTable).set(update).where(eq(executionRoutesTable.id, id));
}

// ---------------------------------------------------------------------------
// Execution Fills
// ---------------------------------------------------------------------------

export async function insertExecutionFill(data: InsertExecutionFill) {
  const [row] = await db.insert(executionFillsTable).values(data).returning();
  return row!;
}

export async function getOrderFills(orderId: string) {
  return db
    .select()
    .from(executionFillsTable)
    .where(eq(executionFillsTable.orderId, orderId))
    .orderBy(executionFillsTable.filledAt);
}

export async function listFills(opts: {
  accountId?: string;
  symbol?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}) {
  const conditions = [];
  if (opts.symbol) conditions.push(eq(executionOrdersTable.symbol, opts.symbol));
  if (opts.from) conditions.push(gte(executionFillsTable.filledAt, opts.from));
  if (opts.to) conditions.push(lte(executionFillsTable.filledAt, opts.to));

  return db
    .select({
      fill: executionFillsTable,
      order: {
        id: executionOrdersTable.id,
        symbol: executionOrdersTable.symbol,
        side: executionOrdersTable.side,
        orderType: executionOrdersTable.orderType,
        accountId: executionOrdersTable.accountId,
        executionMode: executionOrdersTable.executionMode,
        strategyName: executionOrdersTable.strategyName,
      },
    })
    .from(executionFillsTable)
    .innerJoin(executionOrdersTable, eq(executionFillsTable.orderId, executionOrdersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(executionFillsTable.filledAt))
    .limit(opts.limit ?? 100);
}

// ---------------------------------------------------------------------------
// Execution Positions
// ---------------------------------------------------------------------------

export async function insertExecutionPosition(data: InsertExecutionPosition) {
  const [row] = await db.insert(executionPositionsTable).values(data).returning();
  return row!;
}

export async function getExecutionPosition(id: string) {
  const [row] = await db
    .select()
    .from(executionPositionsTable)
    .where(eq(executionPositionsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function getOpenPositionForSymbol(accountId: string, symbol: string) {
  const [row] = await db
    .select()
    .from(executionPositionsTable)
    .where(
      and(
        eq(executionPositionsTable.accountId, accountId),
        eq(executionPositionsTable.symbol, symbol),
        eq(executionPositionsTable.status, "open"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function updateExecutionPosition(
  id: string,
  update: Partial<{
    quantity: string;
    avgEntryPrice: string;
    currentPrice: string;
    unrealizedPnl: string;
    realizedPnl: string;
    totalCommission: string;
    notionalValue: string;
    status: string;
    closeOrderId: string;
    closedAt: Date;
  }>,
) {
  await db
    .update(executionPositionsTable)
    .set({ ...update, updatedAt: new Date() })
    .where(eq(executionPositionsTable.id, id));
}

export async function listPositions(opts: {
  accountId?: string;
  status?: string;
  symbol?: string;
  mode?: string;
  limit?: number;
}) {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(executionPositionsTable.accountId, opts.accountId));
  if (opts.status) conditions.push(eq(executionPositionsTable.status, opts.status));
  if (opts.symbol) conditions.push(eq(executionPositionsTable.symbol, opts.symbol));
  if (opts.mode) conditions.push(eq(executionPositionsTable.executionMode, opts.mode));

  const q = db
    .select()
    .from(executionPositionsTable)
    .orderBy(desc(executionPositionsTable.openedAt))
    .limit(opts.limit ?? 100);

  if (conditions.length > 0) return q.where(and(...conditions));
  return q;
}

// ---------------------------------------------------------------------------
// Execution Sessions
// ---------------------------------------------------------------------------

export async function insertExecutionSession(data: InsertExecutionSession) {
  const [row] = await db.insert(executionSessionsTable).values(data).returning();
  return row!;
}

export async function updateExecutionSession(
  id: string,
  update: Partial<{
    status: string;
    ordersPlaced: string;
    ordersFilled: string;
    ordersRejected: string;
    ordersCancelled: string;
    fillsProcessed: string;
    errorMessage: string;
    endedAt: Date;
  }>,
) {
  await db.update(executionSessionsTable).set(update).where(eq(executionSessionsTable.id, id));
}

export async function getActiveExecutionSession(mode: string) {
  const [row] = await db
    .select()
    .from(executionSessionsTable)
    .where(and(eq(executionSessionsTable.executionMode, mode), eq(executionSessionsTable.status, "active")))
    .orderBy(desc(executionSessionsTable.startedAt))
    .limit(1);
  return row ?? null;
}

export async function listExecutionSessions(limit = 20) {
  return db
    .select()
    .from(executionSessionsTable)
    .orderBy(desc(executionSessionsTable.startedAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Execution Rejections
// ---------------------------------------------------------------------------

export async function insertExecutionRejection(data: InsertExecutionRejection) {
  const [row] = await db.insert(executionRejectionsTable).values(data).returning();
  return row!;
}

export async function listRejections(opts: { symbol?: string; stage?: string; limit?: number; mode?: string }) {
  const conditions = [];
  if (opts.symbol) conditions.push(eq(executionRejectionsTable.symbol, opts.symbol));
  if (opts.stage) conditions.push(eq(executionRejectionsTable.stage, opts.stage));
  if (opts.mode) conditions.push(eq(executionRejectionsTable.executionMode, opts.mode));

  const q = db
    .select()
    .from(executionRejectionsTable)
    .orderBy(desc(executionRejectionsTable.createdAt))
    .limit(opts.limit ?? 50);

  if (conditions.length > 0) return q.where(and(...conditions));
  return q;
}

// ---------------------------------------------------------------------------
// Execution Latency
// ---------------------------------------------------------------------------

export async function insertExecutionLatency(data: InsertExecutionLatency) {
  await db.insert(executionLatencyTable).values(data);
}

export async function getLatencySummary(provider?: string) {
  const stages = ["validation", "risk", "routing", "provider", "fill", "end_to_end"];
  const result: Record<string, { avg: number; min: number; max: number; p95: number; count: number }> = {};

  for (const stage of stages) {
    const conditions = [eq(executionLatencyTable.stage, stage)];
    if (provider) conditions.push(eq(executionLatencyTable.provider, provider));

    const rows = await db
      .select({ latencyMs: executionLatencyTable.latencyMs })
      .from(executionLatencyTable)
      .where(and(...conditions))
      .orderBy(executionLatencyTable.latencyMs)
      .limit(1000);

    if (rows.length === 0) continue;

    const vals = rows.map((r) => parseFloat(r.latencyMs as string));
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const min = vals[0]!;
    const max = vals[vals.length - 1]!;
    const p95 = vals[Math.floor(vals.length * 0.95)] ?? max;

    result[`${provider ?? "all"}:${stage}`] = { avg, min, max, p95, count: vals.length };
  }

  return result;
}

// ---------------------------------------------------------------------------
// Execution Metrics
// ---------------------------------------------------------------------------

export async function insertExecutionMetric(data: InsertExecutionMetric) {
  const [row] = await db.insert(executionMetricsTable).values(data).returning();
  return row!;
}

export async function listExecutionMetrics(opts: { mode?: string; period?: string; limit?: number }) {
  const conditions = [];
  if (opts.mode) conditions.push(eq(executionMetricsTable.executionMode, opts.mode));
  if (opts.period) conditions.push(eq(executionMetricsTable.period, opts.period));

  const q = db
    .select()
    .from(executionMetricsTable)
    .orderBy(desc(executionMetricsTable.computedAt))
    .limit(opts.limit ?? 20);

  if (conditions.length > 0) return q.where(and(...conditions));
  return q;
}

// ---------------------------------------------------------------------------
// Execution Recovery
// ---------------------------------------------------------------------------

export async function insertExecutionRecovery(data: InsertExecutionRecovery) {
  const [row] = await db.insert(executionRecoveryTable).values(data).returning();
  return row!;
}

export async function updateExecutionRecovery(
  id: string,
  update: Partial<{ status: string; errorMessage: string; resolvedAt: Date }>,
) {
  await db.update(executionRecoveryTable).set(update).where(eq(executionRecoveryTable.id, id));
}

export async function listRecoveryEvents(limit = 50) {
  return db
    .select()
    .from(executionRecoveryTable)
    .orderBy(desc(executionRecoveryTable.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Execution Audit Log
// ---------------------------------------------------------------------------

export async function insertExecutionAuditLog(data: InsertExecutionAuditLog) {
  await db.insert(executionAuditLogTable).values(data);
}

export async function listExecutionAuditLog(opts: {
  orderId?: string;
  action?: string;
  symbol?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions = [];
  if (opts.orderId) conditions.push(eq(executionAuditLogTable.orderId, opts.orderId));
  if (opts.action) conditions.push(eq(executionAuditLogTable.action, opts.action));
  if (opts.symbol) conditions.push(eq(executionAuditLogTable.symbol, opts.symbol));

  const q = db
    .select()
    .from(executionAuditLogTable)
    .orderBy(desc(executionAuditLogTable.createdAt))
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);

  if (conditions.length > 0) return q.where(and(...conditions));
  return q;
}

export async function countExecutionAuditLog(opts: { orderId?: string; action?: string }) {
  const conditions = [];
  if (opts.orderId) conditions.push(eq(executionAuditLogTable.orderId, opts.orderId));
  if (opts.action) conditions.push(eq(executionAuditLogTable.action, opts.action));

  const q = db
    .select({ count: sql<number>`count(*)::int` })
    .from(executionAuditLogTable);

  const [row] = conditions.length > 0 ? await q.where(and(...conditions)) : await q;
  return row?.count ?? 0;
}
