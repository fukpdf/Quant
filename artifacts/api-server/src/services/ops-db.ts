/**
 * ops-db.ts — DB access layer for Phase 12 Observability & Operations Platform.
 *
 * All reads and writes to the 15 Phase 12 tables go through this module.
 */

import { db } from "@workspace/db";
import { eq, desc, and, gte, lte, sql, isNull } from "drizzle-orm";
import {
  systemMetricsTable,
  serviceHealthTable,
  schedulerHealthTable,
  apiMetricsTable,
  strategyHealthTable,
  executionHealthTable,
  streamHealthHistoryTable,
  aiHealthTable,
  alertRulesTable,
  alertEventsTable,
  incidentsTable,
  incidentTimelineTable,
  uptimeHistoryTable,
  performanceSnapshotsTable,
  monitoringAuditLogTable,
  type InsertSystemMetrics,
  type InsertServiceHealth,
  type InsertSchedulerHealth,
  type InsertApiMetrics,
  type InsertStrategyHealth,
  type InsertExecutionHealth,
  type InsertStreamHealthHistory,
  type InsertAiHealth,
  type InsertAlertRule,
  type InsertAlertEvent,
  type InsertIncident,
  type InsertIncidentTimeline,
  type InsertUptimeHistory,
  type InsertPerformanceSnapshot,
  type InsertMonitoringAuditLog,
} from "@workspace/db/schema";

// ---------------------------------------------------------------------------
// System Metrics
// ---------------------------------------------------------------------------

export async function insertSystemMetrics(data: InsertSystemMetrics) {
  const [row] = await db.insert(systemMetricsTable).values(data).returning();
  return row;
}

export async function getLatestSystemMetrics() {
  const [row] = await db
    .select()
    .from(systemMetricsTable)
    .orderBy(desc(systemMetricsTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listSystemMetrics(opts: { limit?: number; since?: Date } = {}) {
  const { limit = 60, since } = opts;
  let query = db.select().from(systemMetricsTable).$dynamic();
  if (since) {
    query = query.where(gte(systemMetricsTable.createdAt, since));
  }
  return query.orderBy(desc(systemMetricsTable.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Service Health
// ---------------------------------------------------------------------------

export async function insertServiceHealth(data: InsertServiceHealth) {
  const [row] = await db.insert(serviceHealthTable).values(data).returning();
  return row;
}

export async function getLatestServiceHealth(service: string) {
  const [row] = await db
    .select()
    .from(serviceHealthTable)
    .where(eq(serviceHealthTable.service, service))
    .orderBy(desc(serviceHealthTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listLatestServiceHealth() {
  const subq = db
    .select({ service: serviceHealthTable.service, maxCreated: sql<Date>`max(${serviceHealthTable.createdAt})`.as("max_created") })
    .from(serviceHealthTable)
    .groupBy(serviceHealthTable.service)
    .as("latest");

  return db
    .select({ sh: serviceHealthTable })
    .from(serviceHealthTable)
    .innerJoin(subq, and(
      eq(serviceHealthTable.service, subq.service),
      eq(serviceHealthTable.createdAt, subq.maxCreated),
    ))
    .orderBy(serviceHealthTable.service);
}

export async function listServiceHealthHistory(service: string, limit = 50) {
  return db
    .select()
    .from(serviceHealthTable)
    .where(eq(serviceHealthTable.service, service))
    .orderBy(desc(serviceHealthTable.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Scheduler Health
// ---------------------------------------------------------------------------

export async function upsertSchedulerHealth(data: InsertSchedulerHealth) {
  const [row] = await db.insert(schedulerHealthTable).values(data).returning();
  return row;
}

export async function getLatestSchedulerHealth(schedulerName: string) {
  const [row] = await db
    .select()
    .from(schedulerHealthTable)
    .where(eq(schedulerHealthTable.schedulerName, schedulerName))
    .orderBy(desc(schedulerHealthTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listLatestSchedulerHealth() {
  const subq = db
    .select({ name: schedulerHealthTable.schedulerName, maxCreated: sql<Date>`max(${schedulerHealthTable.createdAt})`.as("max_created") })
    .from(schedulerHealthTable)
    .groupBy(schedulerHealthTable.schedulerName)
    .as("latest_sched");

  return db
    .select({ s: schedulerHealthTable })
    .from(schedulerHealthTable)
    .innerJoin(subq, and(
      eq(schedulerHealthTable.schedulerName, subq.name),
      eq(schedulerHealthTable.createdAt, subq.maxCreated),
    ))
    .orderBy(schedulerHealthTable.schedulerName);
}

// ---------------------------------------------------------------------------
// API Metrics
// ---------------------------------------------------------------------------

export async function insertApiMetrics(data: InsertApiMetrics) {
  const [row] = await db.insert(apiMetricsTable).values(data).returning();
  return row;
}

export async function listApiMetrics(opts: { endpoint?: string; since?: Date; limit?: number } = {}) {
  const { endpoint, since, limit = 100 } = opts;
  const conditions = [];
  if (endpoint) conditions.push(eq(apiMetricsTable.endpoint, endpoint));
  if (since) conditions.push(gte(apiMetricsTable.windowStart, since));

  let query = db.select().from(apiMetricsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(apiMetricsTable.windowStart)).limit(limit);
}

// ---------------------------------------------------------------------------
// Strategy Health
// ---------------------------------------------------------------------------

export async function insertStrategyHealth(data: InsertStrategyHealth) {
  const [row] = await db.insert(strategyHealthTable).values(data).returning();
  return row;
}

export async function listLatestStrategyHealth(limit = 50) {
  const subq = db
    .select({ name: strategyHealthTable.strategyName, maxCreated: sql<Date>`max(${strategyHealthTable.createdAt})`.as("max_created") })
    .from(strategyHealthTable)
    .groupBy(strategyHealthTable.strategyName)
    .as("latest_strat");

  return db
    .select({ s: strategyHealthTable })
    .from(strategyHealthTable)
    .innerJoin(subq, and(
      eq(strategyHealthTable.strategyName, subq.name),
      eq(strategyHealthTable.createdAt, subq.maxCreated),
    ))
    .orderBy(strategyHealthTable.strategyName)
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Execution Health
// ---------------------------------------------------------------------------

export async function insertExecutionHealth(data: InsertExecutionHealth) {
  const [row] = await db.insert(executionHealthTable).values(data).returning();
  return row;
}

export async function getLatestExecutionHealth(window = "1h") {
  const [row] = await db
    .select()
    .from(executionHealthTable)
    .where(eq(executionHealthTable.window, window))
    .orderBy(desc(executionHealthTable.createdAt))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Stream Health History
// ---------------------------------------------------------------------------

export async function insertStreamHealthHistory(data: InsertStreamHealthHistory) {
  const [row] = await db.insert(streamHealthHistoryTable).values(data).returning();
  return row;
}

export async function listLatestStreamHealthHistory() {
  const subq = db
    .select({ provider: streamHealthHistoryTable.provider, maxCreated: sql<Date>`max(${streamHealthHistoryTable.createdAt})`.as("max_created") })
    .from(streamHealthHistoryTable)
    .groupBy(streamHealthHistoryTable.provider)
    .as("latest_stream");

  return db
    .select({ s: streamHealthHistoryTable })
    .from(streamHealthHistoryTable)
    .innerJoin(subq, and(
      eq(streamHealthHistoryTable.provider, subq.provider),
      eq(streamHealthHistoryTable.createdAt, subq.maxCreated),
    ))
    .orderBy(streamHealthHistoryTable.provider);
}

// ---------------------------------------------------------------------------
// AI Health
// ---------------------------------------------------------------------------

export async function insertAiHealth(data: InsertAiHealth) {
  const [row] = await db.insert(aiHealthTable).values(data).returning();
  return row;
}

export async function getLatestAiHealth(provider: string, window = "1h") {
  const [row] = await db
    .select()
    .from(aiHealthTable)
    .where(and(eq(aiHealthTable.provider, provider), eq(aiHealthTable.window, window)))
    .orderBy(desc(aiHealthTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listLatestAiHealth() {
  const subq = db
    .select({ provider: aiHealthTable.provider, window: aiHealthTable.window, maxCreated: sql<Date>`max(${aiHealthTable.createdAt})`.as("max_created") })
    .from(aiHealthTable)
    .where(eq(aiHealthTable.window, "1h"))
    .groupBy(aiHealthTable.provider, aiHealthTable.window)
    .as("latest_ai");

  return db
    .select({ a: aiHealthTable })
    .from(aiHealthTable)
    .innerJoin(subq, and(
      eq(aiHealthTable.provider, subq.provider),
      eq(aiHealthTable.window, subq.window),
      eq(aiHealthTable.createdAt, subq.maxCreated),
    ))
    .orderBy(aiHealthTable.provider);
}

// ---------------------------------------------------------------------------
// Alert Rules
// ---------------------------------------------------------------------------

export async function insertAlertRule(data: InsertAlertRule) {
  const [row] = await db.insert(alertRulesTable).values(data).returning();
  return row;
}

export async function upsertAlertRule(data: InsertAlertRule) {
  const [row] = await db
    .insert(alertRulesTable)
    .values(data)
    .onConflictDoUpdate({
      target: alertRulesTable.name,
      set: {
        displayName: data.displayName,
        category: data.category,
        severity: data.severity,
        condition: data.condition,
        threshold: data.threshold,
        cooldownMinutes: data.cooldownMinutes,
        description: data.description,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function listAlertRules(opts: { category?: string; severity?: string; enabled?: boolean } = {}) {
  const conditions = [];
  if (opts.category) conditions.push(eq(alertRulesTable.category, opts.category));
  if (opts.severity) conditions.push(eq(alertRulesTable.severity, opts.severity));
  if (opts.enabled !== undefined) conditions.push(eq(alertRulesTable.isEnabled, opts.enabled));

  let query = db.select().from(alertRulesTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(alertRulesTable.category, alertRulesTable.name);
}

export async function getAlertRuleByName(name: string) {
  const [row] = await db.select().from(alertRulesTable).where(eq(alertRulesTable.name, name)).limit(1);
  return row ?? null;
}

export async function updateAlertRuleEnabled(name: string, isEnabled: boolean) {
  const [row] = await db
    .update(alertRulesTable)
    .set({ isEnabled, updatedAt: new Date() })
    .where(eq(alertRulesTable.name, name))
    .returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Alert Events
// ---------------------------------------------------------------------------

export async function insertAlertEvent(data: InsertAlertEvent) {
  const [row] = await db.insert(alertEventsTable).values(data).returning();
  return row;
}

export async function listAlertEvents(opts: {
  status?: string;
  severity?: string;
  service?: string;
  since?: Date;
  limit?: number;
  offset?: number;
} = {}) {
  const { status, severity, service, since, limit = 50, offset = 0 } = opts;
  const conditions = [];
  if (status) conditions.push(eq(alertEventsTable.status, status));
  if (severity) conditions.push(eq(alertEventsTable.severity, severity));
  if (service) conditions.push(eq(alertEventsTable.service, service));
  if (since) conditions.push(gte(alertEventsTable.firedAt, since));

  let query = db.select().from(alertEventsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(alertEventsTable.firedAt)).limit(limit).offset(offset);
}

export async function getActiveAlertCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(alertEventsTable)
    .where(eq(alertEventsTable.status, "active"));
  return row?.count ?? 0;
}

export async function acknowledgeAlert(id: string) {
  const [row] = await db
    .update(alertEventsTable)
    .set({ status: "acknowledged", acknowledgedAt: new Date() })
    .where(and(eq(alertEventsTable.id, id), eq(alertEventsTable.status, "active")))
    .returning();
  return row ?? null;
}

export async function resolveAlert(id: string) {
  const [row] = await db
    .update(alertEventsTable)
    .set({ status: "resolved", resolvedAt: new Date() })
    .where(eq(alertEventsTable.id, id))
    .returning();
  return row ?? null;
}

export async function getLastAlertFiredAt(ruleName: string): Promise<Date | null> {
  const [row] = await db
    .select({ firedAt: alertEventsTable.firedAt })
    .from(alertEventsTable)
    .where(eq(alertEventsTable.ruleName, ruleName))
    .orderBy(desc(alertEventsTable.firedAt))
    .limit(1);
  return row?.firedAt ?? null;
}

// ---------------------------------------------------------------------------
// Incidents
// ---------------------------------------------------------------------------

export async function insertIncident(data: InsertIncident) {
  const [row] = await db.insert(incidentsTable).values(data).returning();
  return row;
}

export async function listIncidents(opts: {
  status?: string;
  severity?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const { status, severity, limit = 50, offset = 0 } = opts;
  const conditions = [];
  if (status) conditions.push(eq(incidentsTable.status, status));
  if (severity) conditions.push(eq(incidentsTable.severity, severity));

  let query = db.select().from(incidentsTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(incidentsTable.openedAt)).limit(limit).offset(offset);
}

export async function getIncidentById(id: string) {
  const [row] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id)).limit(1);
  return row ?? null;
}

export async function getOpenIncidentCount() {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(incidentsTable)
    .where(sql`${incidentsTable.status} in ('open','investigating')`);
  return row?.count ?? 0;
}

export async function updateIncidentStatus(id: string, status: "investigating" | "resolved", notes?: string) {
  const setData: Record<string, unknown> = { status };
  if (status === "investigating") setData["investigatingAt"] = new Date();
  if (status === "resolved") {
    setData["resolvedAt"] = new Date();
    if (notes) setData["resolution"] = notes;
  }
  const [row] = await db.update(incidentsTable).set(setData).where(eq(incidentsTable.id, id)).returning();
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Incident Timeline
// ---------------------------------------------------------------------------

export async function insertIncidentTimeline(data: InsertIncidentTimeline) {
  const [row] = await db.insert(incidentTimelineTable).values(data).returning();
  return row;
}

export async function listIncidentTimeline(incidentId: string) {
  return db
    .select()
    .from(incidentTimelineTable)
    .where(eq(incidentTimelineTable.incidentId, incidentId))
    .orderBy(incidentTimelineTable.createdAt);
}

// ---------------------------------------------------------------------------
// Uptime History
// ---------------------------------------------------------------------------

export async function insertUptimeHistory(data: InsertUptimeHistory) {
  const [row] = await db.insert(uptimeHistoryTable).values(data).returning();
  return row;
}

export async function listUptimeHistory(opts: { service?: string; since?: Date; limit?: number } = {}) {
  const { service, since, limit = 100 } = opts;
  const conditions = [];
  if (service) conditions.push(eq(uptimeHistoryTable.service, service));
  if (since) conditions.push(gte(uptimeHistoryTable.fromTime, since));

  let query = db.select().from(uptimeHistoryTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(uptimeHistoryTable.fromTime)).limit(limit);
}

export async function getOpenUptimeWindow(service: string) {
  const [row] = await db
    .select()
    .from(uptimeHistoryTable)
    .where(and(eq(uptimeHistoryTable.service, service), isNull(uptimeHistoryTable.toTime)))
    .orderBy(desc(uptimeHistoryTable.fromTime))
    .limit(1);
  return row ?? null;
}

export async function closeUptimeWindow(id: string, toTime: Date) {
  const row = await db.select().from(uptimeHistoryTable).where(eq(uptimeHistoryTable.id, id)).limit(1);
  if (!row[0]) return null;
  const fromTime = row[0].fromTime;
  const durationSeconds = Math.floor((toTime.getTime() - fromTime.getTime()) / 1000);
  const [updated] = await db
    .update(uptimeHistoryTable)
    .set({ toTime, durationSeconds: String(durationSeconds) })
    .where(eq(uptimeHistoryTable.id, id))
    .returning();
  return updated ?? null;
}

// ---------------------------------------------------------------------------
// Performance Snapshots
// ---------------------------------------------------------------------------

export async function insertPerformanceSnapshot(data: InsertPerformanceSnapshot) {
  const [row] = await db.insert(performanceSnapshotsTable).values(data).returning();
  return row;
}

export async function getLatestPerformanceSnapshot() {
  const [row] = await db
    .select()
    .from(performanceSnapshotsTable)
    .orderBy(desc(performanceSnapshotsTable.createdAt))
    .limit(1);
  return row ?? null;
}

export async function listPerformanceSnapshots(opts: { since?: Date; limit?: number } = {}) {
  const { since, limit = 96 } = opts;
  let query = db.select().from(performanceSnapshotsTable).$dynamic();
  if (since) query = query.where(gte(performanceSnapshotsTable.createdAt, since));
  return query.orderBy(desc(performanceSnapshotsTable.createdAt)).limit(limit);
}

// ---------------------------------------------------------------------------
// Monitoring Audit Log
// ---------------------------------------------------------------------------

export async function insertMonitoringAuditLog(data: InsertMonitoringAuditLog) {
  const [row] = await db.insert(monitoringAuditLogTable).values(data).returning();
  return row;
}

export async function listMonitoringAuditLog(opts: {
  action?: string;
  actor?: string;
  targetType?: string;
  since?: Date;
  limit?: number;
  offset?: number;
} = {}) {
  const { action, actor, targetType, since, limit = 100, offset = 0 } = opts;
  const conditions = [];
  if (action) conditions.push(eq(monitoringAuditLogTable.action, action));
  if (actor) conditions.push(eq(monitoringAuditLogTable.actor, actor));
  if (targetType) conditions.push(eq(monitoringAuditLogTable.targetType, targetType));
  if (since) conditions.push(gte(monitoringAuditLogTable.createdAt, since));

  let query = db.select().from(monitoringAuditLogTable).$dynamic();
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(monitoringAuditLogTable.createdAt)).limit(limit).offset(offset);
}
