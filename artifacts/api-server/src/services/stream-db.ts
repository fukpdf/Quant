import { db } from "@workspace/db";
import {
  marketTicksTable,
  marketOrderbooksTable,
  marketTradesTable,
  streamSessionsTable,
  streamHealthTable,
  streamFailuresTable,
  streamRecoveryEventsTable,
  marketStateSnapshotsTable,
  eventBusEventsTable,
  eventProcessingMetricsTable,
  latencyMetricsTable,
  streamAuditLogTable,
  type InsertMarketTick,
  type InsertMarketOrderbook,
  type InsertMarketTrade,
  type InsertStreamSession,
  type InsertStreamHealth,
  type InsertStreamFailure,
  type InsertStreamRecoveryEvent,
  type InsertMarketStateSnapshot,
  type InsertEventBusEvent,
  type InsertEventProcessingMetric,
  type InsertLatencyMetric,
  type InsertStreamAuditLog,
} from "@workspace/db/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Ticks
// ---------------------------------------------------------------------------

export async function insertTick(tick: InsertMarketTick) {
  const [row] = await db.insert(marketTicksTable).values(tick).returning({ id: marketTicksTable.id });
  return row;
}

export async function getRecentTicks(symbol: string, limit = 100) {
  return db
    .select()
    .from(marketTicksTable)
    .where(eq(marketTicksTable.symbol, symbol))
    .orderBy(desc(marketTicksTable.createdAt))
    .limit(limit);
}

export async function getTicksInRange(symbol: string, from: Date, to: Date) {
  return db
    .select()
    .from(marketTicksTable)
    .where(
      and(
        eq(marketTicksTable.symbol, symbol),
        gte(marketTicksTable.createdAt, from),
        lte(marketTicksTable.createdAt, to),
      ),
    )
    .orderBy(marketTicksTable.createdAt);
}

// ---------------------------------------------------------------------------
// Order Books
// ---------------------------------------------------------------------------

export async function insertOrderbook(ob: InsertMarketOrderbook) {
  const [row] = await db.insert(marketOrderbooksTable).values(ob).returning({ id: marketOrderbooksTable.id });
  return row;
}

export async function getLatestOrderbook(symbol: string) {
  const rows = await db
    .select()
    .from(marketOrderbooksTable)
    .where(eq(marketOrderbooksTable.symbol, symbol))
    .orderBy(desc(marketOrderbooksTable.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Market Trades
// ---------------------------------------------------------------------------

export async function insertMarketTrade(trade: InsertMarketTrade) {
  const [row] = await db.insert(marketTradesTable).values(trade).returning({ id: marketTradesTable.id });
  return row;
}

export async function getRecentMarketTrades(symbol: string, limit = 50) {
  return db
    .select()
    .from(marketTradesTable)
    .where(eq(marketTradesTable.symbol, symbol))
    .orderBy(desc(marketTradesTable.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Stream Sessions
// ---------------------------------------------------------------------------

export async function insertStreamSession(session: InsertStreamSession) {
  const [row] = await db.insert(streamSessionsTable).values(session).returning();
  return row!;
}

export async function updateStreamSession(id: string, update: Partial<InsertStreamSession>) {
  const [row] = await db
    .update(streamSessionsTable)
    .set(update)
    .where(eq(streamSessionsTable.id, id))
    .returning();
  return row;
}

export async function getStreamSessions(limit = 50) {
  return db.select().from(streamSessionsTable).orderBy(desc(streamSessionsTable.startedAt)).limit(limit);
}

export async function getActiveSession(provider: string) {
  const rows = await db
    .select()
    .from(streamSessionsTable)
    .where(and(eq(streamSessionsTable.provider, provider), eq(streamSessionsTable.status, "active")))
    .orderBy(desc(streamSessionsTable.startedAt))
    .limit(1);
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Stream Health
// ---------------------------------------------------------------------------

export async function insertStreamHealth(health: InsertStreamHealth) {
  await db.insert(streamHealthTable).values(health);
}

export async function getLatestStreamHealth(provider?: string) {
  if (provider) {
    const rows = await db
      .select()
      .from(streamHealthTable)
      .where(eq(streamHealthTable.provider, provider))
      .orderBy(desc(streamHealthTable.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  // Latest per provider using raw subquery approach
  return db
    .selectDistinctOn([streamHealthTable.provider])
    .from(streamHealthTable)
    .orderBy(streamHealthTable.provider, desc(streamHealthTable.createdAt));
}

// ---------------------------------------------------------------------------
// Stream Failures
// ---------------------------------------------------------------------------

export async function insertStreamFailure(failure: InsertStreamFailure) {
  const [row] = await db.insert(streamFailuresTable).values(failure).returning();
  return row!;
}

export async function updateStreamFailure(id: string, update: Partial<InsertStreamFailure>) {
  await db.update(streamFailuresTable).set(update).where(eq(streamFailuresTable.id, id));
}

export async function getStreamFailures(limit = 100) {
  return db.select().from(streamFailuresTable).orderBy(desc(streamFailuresTable.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Stream Recovery Events
// ---------------------------------------------------------------------------

export async function insertRecoveryEvent(event: InsertStreamRecoveryEvent) {
  const [row] = await db.insert(streamRecoveryEventsTable).values(event).returning();
  return row!;
}

export async function updateRecoveryEvent(id: string, update: Partial<InsertStreamRecoveryEvent>) {
  await db.update(streamRecoveryEventsTable).set(update).where(eq(streamRecoveryEventsTable.id, id));
}

export async function getRecoveryEvents(limit = 50) {
  return db.select().from(streamRecoveryEventsTable).orderBy(desc(streamRecoveryEventsTable.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Market State Snapshots
// ---------------------------------------------------------------------------

export async function insertMarketStateSnapshot(snapshot: InsertMarketStateSnapshot) {
  await db.insert(marketStateSnapshotsTable).values(snapshot);
}

export async function getLatestMarketState(symbol?: string) {
  if (symbol) {
    const rows = await db
      .select()
      .from(marketStateSnapshotsTable)
      .where(eq(marketStateSnapshotsTable.symbol, symbol))
      .orderBy(desc(marketStateSnapshotsTable.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  return db
    .selectDistinctOn([marketStateSnapshotsTable.symbol])
    .from(marketStateSnapshotsTable)
    .orderBy(marketStateSnapshotsTable.symbol, desc(marketStateSnapshotsTable.createdAt));
}

// ---------------------------------------------------------------------------
// Event Bus Events
// ---------------------------------------------------------------------------

export async function insertEventBusEvent(event: InsertEventBusEvent) {
  await db.insert(eventBusEventsTable).values(event);
}

export async function getEventBusEvents(eventType?: string, limit = 100) {
  if (eventType) {
    return db
      .select()
      .from(eventBusEventsTable)
      .where(eq(eventBusEventsTable.eventType, eventType))
      .orderBy(desc(eventBusEventsTable.createdAt))
      .limit(limit);
  }
  return db.select().from(eventBusEventsTable).orderBy(desc(eventBusEventsTable.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Event Processing Metrics
// ---------------------------------------------------------------------------

export async function insertEventProcessingMetric(metric: InsertEventProcessingMetric) {
  await db.insert(eventProcessingMetricsTable).values(metric);
}

export async function getEventProcessingMetrics(processor?: string, limit = 100) {
  if (processor) {
    return db
      .select()
      .from(eventProcessingMetricsTable)
      .where(eq(eventProcessingMetricsTable.processor, processor))
      .orderBy(desc(eventProcessingMetricsTable.windowStart))
      .limit(limit);
  }
  return db.select().from(eventProcessingMetricsTable).orderBy(desc(eventProcessingMetricsTable.windowStart)).limit(limit);
}

// ---------------------------------------------------------------------------
// Latency Metrics
// ---------------------------------------------------------------------------

export async function insertLatencyMetric(metric: InsertLatencyMetric) {
  await db.insert(latencyMetricsTable).values(metric);
}

export async function getLatencyMetrics(provider?: string, metricType?: string, limit = 200) {
  const conditions = [];
  if (provider) conditions.push(eq(latencyMetricsTable.provider, provider));
  if (metricType) conditions.push(eq(latencyMetricsTable.metricType, metricType));

  return db
    .select()
    .from(latencyMetricsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(latencyMetricsTable.createdAt))
    .limit(limit);
}

export async function getLatencyStats(provider: string, metricType: string, windowMinutes = 5) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const rows = await db
    .select({
      avg: sql<string>`avg(${latencyMetricsTable.valueMs})`,
      min: sql<string>`min(${latencyMetricsTable.valueMs})`,
      max: sql<string>`max(${latencyMetricsTable.valueMs})`,
      p95: sql<string>`percentile_cont(0.95) within group (order by ${latencyMetricsTable.valueMs})`,
      p99: sql<string>`percentile_cont(0.99) within group (order by ${latencyMetricsTable.valueMs})`,
      count: sql<string>`count(*)`,
    })
    .from(latencyMetricsTable)
    .where(
      and(
        eq(latencyMetricsTable.provider, provider),
        eq(latencyMetricsTable.metricType, metricType),
        gte(latencyMetricsTable.createdAt, since),
      ),
    );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Stream Audit Log
// ---------------------------------------------------------------------------

export async function insertStreamAudit(entry: InsertStreamAuditLog) {
  await db.insert(streamAuditLogTable).values(entry);
}

export async function getStreamAuditLog(limit = 200) {
  return db.select().from(streamAuditLogTable).orderBy(desc(streamAuditLogTable.createdAt)).limit(limit);
}
