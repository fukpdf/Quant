import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_usage_metrics — token usage and cost tracking per provider.
 * Every LLM call writes a usage record for cost control and budget monitoring.
 * Provider monitoring and rate limiting decisions are based on this table.
 *
 * Operation types: chat | report | summary | insight | explanation | analysis | comparison
 */
export const aiUsageMetricsTable = pgTable(
  "ai_usage_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Provider: openai | anthropic | gemini | mock */
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Model name */
    model: varchar("model", { length: 100 }),
    /** Operation type */
    operationType: varchar("operation_type", { length: 50 }).notNull(),
    /** Reference to the conversation if applicable */
    conversationId: uuid("conversation_id"),
    /** Reference to the query if applicable */
    queryId: uuid("query_id"),
    /** Reference to the report if applicable */
    reportId: uuid("report_id"),
    /** Token counts */
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    /** Estimated cost in USD (stored as numeric string) */
    estimatedCostUsd: numeric("estimated_cost_usd", { precision: 12, scale: 8 }),
    /** Latency in milliseconds */
    latencyMs: integer("latency_ms"),
    /** success | failure | timeout | rate_limited */
    status: varchar("status", { length: 20 }).notNull().default("success"),
    /** Additional metadata */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_usage_metrics_provider_idx").on(table.provider),
    index("ai_usage_metrics_operation_idx").on(table.operationType),
    index("ai_usage_metrics_created_at_idx").on(table.createdAt),
    index("ai_usage_metrics_status_idx").on(table.status),
  ],
);

export const insertAiUsageMetricSchema = createInsertSchema(aiUsageMetricsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiUsageMetricSchema = createSelectSchema(aiUsageMetricsTable);

export type InsertAiUsageMetric = z.infer<typeof insertAiUsageMetricSchema>;
export type AiUsageMetric = typeof aiUsageMetricsTable.$inferSelect;
