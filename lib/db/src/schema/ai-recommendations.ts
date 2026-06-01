import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_recommendations — AI-explained versions of rule-based recommendations.
 * While Phase 7's recommendation engine fires rule-based recommendations,
 * this table stores AI-generated explanations of WHY those recommendations apply.
 *
 * IMPORTANT: AI explanations describe observations, not trade instructions.
 * AI will NOT recommend: trades, entries, exits, leverage, or position sizing.
 *
 * Category: diversification | concentration | drawdown | performance | idle_capital | benchmark | rebalance
 */
export const aiRecommendationsTable = pgTable(
  "ai_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Category of the recommendation */
    category: varchar("category", { length: 50 }).notNull(),
    /** Priority: low | medium | high */
    priority: varchar("priority", { length: 20 }).notNull().default("medium"),
    /** Short title */
    title: varchar("title", { length: 255 }).notNull(),
    /** Rule-based trigger text from Phase 7 */
    triggerDescription: text("trigger_description"),
    /** AI-generated explanation of why this applies to the current portfolio */
    aiExplanation: text("ai_explanation").notNull(),
    /** Account ID */
    accountId: uuid("account_id"),
    /** Supporting data metrics */
    supportingData: jsonb("supporting_data"),
    /** Whether the user has dismissed this */
    dismissed: boolean("dismissed").notNull().default(false),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    /** Reference to the Phase 7 portfolio_recommendations row */
    portfolioRecommendationId: uuid("portfolio_recommendation_id"),
    /** Context snapshot used */
    contextSnapshotId: uuid("context_snapshot_id"),
    /** Provider used */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_recommendations_account_idx").on(table.accountId),
    index("ai_recommendations_category_idx").on(table.category),
    index("ai_recommendations_dismissed_idx").on(table.dismissed),
    index("ai_recommendations_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendationsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiRecommendationSchema = createSelectSchema(aiRecommendationsTable);

export type InsertAiRecommendation = z.infer<typeof insertAiRecommendationSchema>;
export type AiRecommendation = typeof aiRecommendationsTable.$inferSelect;
