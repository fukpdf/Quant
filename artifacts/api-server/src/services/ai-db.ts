import { db } from "@workspace/db";
import {
  aiConversationsTable,
  aiQueriesTable,
  aiContextSnapshotsTable,
  aiReportsTable,
  aiInsightsTable,
  aiSummariesTable,
  aiExplanationsTable,
  aiRecommendationsTable,
  aiUsageMetricsTable,
  aiAuditLogTable,
  type InsertAiConversation,
  type InsertAiQuery,
  type InsertAiContextSnapshot,
  type InsertAiReport,
  type InsertAiInsight,
  type InsertAiSummary,
  type InsertAiExplanation,
  type InsertAiRecommendation,
  type InsertAiUsageMetric,
  type InsertAiAuditLog,
  type AiConversation,
  type AiQuery,
  type AiContextSnapshot,
  type AiReport,
  type AiInsight,
  type AiSummary,
  type AiAuditLog,
  type AiUsageMetric,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function createConversation(data: InsertAiConversation): Promise<AiConversation> {
  const rows = await db.insert(aiConversationsTable).values(data).returning();
  return rows[0]!;
}

export async function getConversation(id: string): Promise<AiConversation | undefined> {
  const rows = await db
    .select()
    .from(aiConversationsTable)
    .where(eq(aiConversationsTable.id, id))
    .limit(1);
  return rows[0];
}

export async function listConversations(opts: {
  accountId?: string;
  status?: string;
  limit?: number;
}): Promise<AiConversation[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(aiConversationsTable.accountId, opts.accountId));
  if (opts.status) conditions.push(eq(aiConversationsTable.status, opts.status));

  return db
    .select()
    .from(aiConversationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiConversationsTable.createdAt))
    .limit(opts.limit ?? 50);
}

export async function incrementConversationTokens(
  id: string,
  promptTokens: number,
  completionTokens: number,
): Promise<void> {
  await db
    .update(aiConversationsTable)
    .set({
      totalPromptTokens: sql`(CAST(total_prompt_tokens AS INTEGER) + ${promptTokens})::TEXT`,
      totalCompletionTokens: sql`(CAST(total_completion_tokens AS INTEGER) + ${completionTokens})::TEXT`,
      queryCount: sql`(CAST(query_count AS INTEGER) + 1)::TEXT`,
    })
    .where(eq(aiConversationsTable.id, id));
}

export async function closeConversation(id: string): Promise<void> {
  await db
    .update(aiConversationsTable)
    .set({ status: "closed", closedAt: new Date() })
    .where(eq(aiConversationsTable.id, id));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function createQuery(data: InsertAiQuery): Promise<AiQuery> {
  const rows = await db.insert(aiQueriesTable).values(data).returning();
  return rows[0]!;
}

export async function listQueriesForConversation(conversationId: string): Promise<AiQuery[]> {
  return db
    .select()
    .from(aiQueriesTable)
    .where(eq(aiQueriesTable.conversationId, conversationId))
    .orderBy(aiQueriesTable.turnIndex);
}

export async function getQueryTurnCount(conversationId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(aiQueriesTable)
    .where(eq(aiQueriesTable.conversationId, conversationId));
  return parseInt(rows[0]?.count ?? "0", 10);
}

// ---------------------------------------------------------------------------
// Context Snapshots
// ---------------------------------------------------------------------------

export async function createContextSnapshot(data: InsertAiContextSnapshot): Promise<AiContextSnapshot> {
  const rows = await db.insert(aiContextSnapshotsTable).values(data).returning();
  return rows[0]!;
}

export async function getContextSnapshot(id: string): Promise<AiContextSnapshot | undefined> {
  const rows = await db
    .select()
    .from(aiContextSnapshotsTable)
    .where(eq(aiContextSnapshotsTable.id, id))
    .limit(1);
  return rows[0];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export async function createReport(data: InsertAiReport): Promise<AiReport> {
  const rows = await db.insert(aiReportsTable).values(data).returning();
  return rows[0]!;
}

export async function getReport(id: string): Promise<AiReport | undefined> {
  const rows = await db
    .select()
    .from(aiReportsTable)
    .where(eq(aiReportsTable.id, id))
    .limit(1);
  return rows[0];
}

export async function listReports(opts: {
  accountId?: string;
  reportType?: string;
  limit?: number;
}): Promise<AiReport[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(aiReportsTable.accountId, opts.accountId));
  if (opts.reportType) conditions.push(eq(aiReportsTable.reportType, opts.reportType));

  return db
    .select()
    .from(aiReportsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiReportsTable.createdAt))
    .limit(opts.limit ?? 50);
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export async function createInsight(data: InsertAiInsight): Promise<AiInsight> {
  const rows = await db.insert(aiInsightsTable).values(data).returning();
  return rows[0]!;
}

export async function listInsights(opts: {
  accountId?: string;
  category?: string;
  severity?: string;
  acknowledged?: boolean;
  limit?: number;
}): Promise<AiInsight[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(aiInsightsTable.accountId, opts.accountId));
  if (opts.category) conditions.push(eq(aiInsightsTable.category, opts.category));
  if (opts.severity) conditions.push(eq(aiInsightsTable.severity, opts.severity));
  if (opts.acknowledged !== undefined) {
    conditions.push(eq(aiInsightsTable.acknowledged, opts.acknowledged));
  }

  return db
    .select()
    .from(aiInsightsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiInsightsTable.createdAt))
    .limit(opts.limit ?? 100);
}

export async function acknowledgeInsight(id: string): Promise<void> {
  await db
    .update(aiInsightsTable)
    .set({ acknowledged: true, acknowledgedAt: new Date() })
    .where(eq(aiInsightsTable.id, id));
}

// ---------------------------------------------------------------------------
// Summaries
// ---------------------------------------------------------------------------

export async function createSummary(data: InsertAiSummary): Promise<AiSummary> {
  const rows = await db.insert(aiSummariesTable).values(data).returning();
  return rows[0]!;
}

export async function listSummaries(opts: {
  accountId?: string;
  domain?: string;
  limit?: number;
}): Promise<AiSummary[]> {
  const conditions = [];
  if (opts.accountId) conditions.push(eq(aiSummariesTable.accountId, opts.accountId));
  if (opts.domain) conditions.push(eq(aiSummariesTable.domain, opts.domain));

  return db
    .select()
    .from(aiSummariesTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiSummariesTable.createdAt))
    .limit(opts.limit ?? 20);
}

// ---------------------------------------------------------------------------
// Explanations
// ---------------------------------------------------------------------------

export async function createExplanation(data: InsertAiExplanation): Promise<void> {
  await db.insert(aiExplanationsTable).values(data);
}

// ---------------------------------------------------------------------------
// AI Recommendations
// ---------------------------------------------------------------------------

export async function createAiRecommendation(data: InsertAiRecommendation): Promise<void> {
  await db.insert(aiRecommendationsTable).values(data);
}

// ---------------------------------------------------------------------------
// Usage Metrics
// ---------------------------------------------------------------------------

export async function recordUsageMetric(data: InsertAiUsageMetric): Promise<void> {
  await db.insert(aiUsageMetricsTable).values(data);
}

export async function listUsageMetrics(opts: {
  provider?: string;
  operationType?: string;
  limit?: number;
}): Promise<AiUsageMetric[]> {
  const conditions = [];
  if (opts.provider) conditions.push(eq(aiUsageMetricsTable.provider, opts.provider));
  if (opts.operationType) conditions.push(eq(aiUsageMetricsTable.operationType, opts.operationType));

  return db
    .select()
    .from(aiUsageMetricsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiUsageMetricsTable.createdAt))
    .limit(opts.limit ?? 200);
}

export async function getUsageSummary(): Promise<{
  totalRequests: number;
  totalTokens: number;
  byProvider: Record<string, { requests: number; tokens: number }>;
}> {
  const rows = await db
    .select({
      provider: aiUsageMetricsTable.provider,
      requests: sql<string>`COUNT(*)`,
      tokens: sql<string>`COALESCE(SUM(total_tokens), 0)`,
    })
    .from(aiUsageMetricsTable)
    .groupBy(aiUsageMetricsTable.provider);

  const byProvider: Record<string, { requests: number; tokens: number }> = {};
  let totalRequests = 0;
  let totalTokens = 0;

  for (const row of rows) {
    const reqs = parseInt(row.requests, 10);
    const toks = parseInt(row.tokens, 10);
    byProvider[row.provider] = { requests: reqs, tokens: toks };
    totalRequests += reqs;
    totalTokens += toks;
  }

  return { totalRequests, totalTokens, byProvider };
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

export async function writeAiAuditLog(data: InsertAiAuditLog): Promise<void> {
  await db.insert(aiAuditLogTable).values(data);
}

export async function listAiAuditLog(opts: {
  action?: string;
  accountId?: string;
  actor?: string;
  result?: string;
  limit?: number;
}): Promise<AiAuditLog[]> {
  const conditions = [];
  if (opts.action) conditions.push(eq(aiAuditLogTable.action, opts.action));
  if (opts.accountId) conditions.push(eq(aiAuditLogTable.accountId, opts.accountId));
  if (opts.actor) conditions.push(eq(aiAuditLogTable.actor, opts.actor));
  if (opts.result) conditions.push(eq(aiAuditLogTable.result, opts.result));

  return db
    .select()
    .from(aiAuditLogTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(aiAuditLogTable.createdAt))
    .limit(opts.limit ?? 200);
}
