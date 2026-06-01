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
 * ai_reports — generated analytical reports.
 * Reports are reproducible: each stores the context snapshot ID and generation
 * parameters so they can be regenerated. Reports are never deleted.
 *
 * Report types: portfolio | strategy | risk | performance | benchmark |
 *               health | diversification | allocation | daily | weekly | monthly
 */
export const aiReportsTable = pgTable(
  "ai_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Report type: portfolio | strategy | risk | performance | benchmark | health | diversification | allocation | daily | weekly | monthly | research */
    reportType: varchar("report_type", { length: 50 }).notNull(),
    /** Human-readable title */
    title: varchar("title", { length: 255 }).notNull(),
    /** Account ID if report is account-scoped */
    accountId: uuid("account_id"),
    /** Strategy name if report is strategy-scoped */
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Reference period: "daily" | "weekly" | "monthly" | "custom" */
    period: varchar("period", { length: 20 }),
    /** Report start date (ISO string) */
    periodStart: varchar("period_start", { length: 30 }),
    /** Report end date (ISO string) */
    periodEnd: varchar("period_end", { length: 30 }),
    /** Full generated report text (markdown) */
    content: text("content").notNull(),
    /** Structured data extracted from report */
    structuredData: jsonb("structured_data"),
    /** Context snapshot used to generate this report */
    contextSnapshotId: uuid("context_snapshot_id"),
    /** Provider used */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    /** Model used */
    model: varchar("model", { length: 100 }),
    /** Token counts */
    promptTokens: varchar("prompt_tokens", { length: 20 }).notNull().default("0"),
    completionTokens: varchar("completion_tokens", { length: 20 }).notNull().default("0"),
    /** Report status: generating | completed | failed */
    status: varchar("status", { length: 20 }).notNull().default("completed"),
    /** Generation parameters (for reproducibility) */
    generationParams: jsonb("generation_params"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_reports_type_idx").on(table.reportType),
    index("ai_reports_account_idx").on(table.accountId),
    index("ai_reports_created_at_idx").on(table.createdAt),
    index("ai_reports_status_idx").on(table.status),
  ],
);

export const insertAiReportSchema = createInsertSchema(aiReportsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiReportSchema = createSelectSchema(aiReportsTable);

export type InsertAiReport = z.infer<typeof insertAiReportSchema>;
export type AiReport = typeof aiReportsTable.$inferSelect;
