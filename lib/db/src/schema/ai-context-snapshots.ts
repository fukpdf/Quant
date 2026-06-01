import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_context_snapshots — frozen point-in-time snapshots of the platform data
 * used to answer an AI query. Stores a structured aggregation of portfolio,
 * risk, research, and paper trading data at the moment of the query.
 *
 * Purpose: reproducibility and auditability. Given a query ID you can always
 * reconstruct exactly what data the AI had access to.
 *
 * Snapshots are reusable across queries within the same conversation turn.
 */
export const aiContextSnapshotsTable = pgTable(
  "ai_context_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Account ID if snapshot is account-scoped */
    accountId: uuid("account_id"),
    /** Domains included: ["portfolio", "risk", "paper", "research", "benchmark"] */
    domains: jsonb("domains").$type<string[]>().notNull().default([]),
    /** Portfolio analytics data at snapshot time */
    portfolioData: jsonb("portfolio_data"),
    /** Risk engine data at snapshot time */
    riskData: jsonb("risk_data"),
    /** Paper trading data at snapshot time */
    paperData: jsonb("paper_data"),
    /** Research/backtest data at snapshot time */
    researchData: jsonb("research_data"),
    /** Benchmark data at snapshot time */
    benchmarkData: jsonb("benchmark_data"),
    /** Health score at snapshot time */
    healthData: jsonb("health_data"),
    /** Recommendations at snapshot time */
    recommendationData: jsonb("recommendation_data"),
    /** Total data points aggregated */
    dataPointCount: varchar("data_point_count", { length: 20 }).notNull().default("0"),
    /** Approximate context size in characters */
    contextSizeChars: varchar("context_size_chars", { length: 20 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_context_snapshots_account_idx").on(table.accountId),
    index("ai_context_snapshots_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiContextSnapshotSchema = createInsertSchema(aiContextSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiContextSnapshotSchema = createSelectSchema(aiContextSnapshotsTable);

export type InsertAiContextSnapshot = z.infer<typeof insertAiContextSnapshotSchema>;
export type AiContextSnapshot = typeof aiContextSnapshotsTable.$inferSelect;
