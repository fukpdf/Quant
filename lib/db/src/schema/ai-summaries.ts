import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_summaries — concise AI-generated summaries of platform domains.
 * Summaries are shorter than reports, targeting a quick overview.
 *
 * Domain: portfolio | strategy | risk | research | benchmark | overall
 * Each domain can have one active summary at a time (replaced on regeneration).
 */
export const aiSummariesTable = pgTable(
  "ai_summaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Domain being summarized */
    domain: varchar("domain", { length: 50 }).notNull(),
    /** Account ID if summary is account-scoped */
    accountId: uuid("account_id"),
    /** Strategy name if summary is strategy-scoped */
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Summary text (markdown) */
    content: text("content").notNull(),
    /** Key data points extracted for the summary */
    keyMetrics: jsonb("key_metrics"),
    /** Tone: neutral | positive | cautionary | critical */
    tone: varchar("tone", { length: 20 }).notNull().default("neutral"),
    /** Context snapshot used */
    contextSnapshotId: uuid("context_snapshot_id"),
    /** Provider used */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    /** Model used */
    model: varchar("model", { length: 100 }),
    /** Token counts */
    promptTokens: varchar("prompt_tokens", { length: 20 }).notNull().default("0"),
    completionTokens: varchar("completion_tokens", { length: 20 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_summaries_domain_idx").on(table.domain),
    index("ai_summaries_account_idx").on(table.accountId),
    index("ai_summaries_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiSummarySchema = createInsertSchema(aiSummariesTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiSummarySchema = createSelectSchema(aiSummariesTable);

export type InsertAiSummary = z.infer<typeof insertAiSummarySchema>;
export type AiSummary = typeof aiSummariesTable.$inferSelect;
