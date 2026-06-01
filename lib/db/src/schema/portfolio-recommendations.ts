import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * portfolio_recommendations — rule-based (no AI) recommendations generated
 * by the analytics engine. Never auto-executed; informational only.
 *
 * Recommendation types:
 *   reduce_concentration | increase_diversification | reduce_exposure
 *   rebalance_portfolio | review_strategy | review_asset_allocation
 *   improve_efficiency | reduce_drawdown_risk
 */
export const portfolioRecommendationsTable = pgTable(
  "portfolio_recommendations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** Recommendation type */
    recommendationType: varchar("recommendation_type", { length: 60 }).notNull(),
    /** Human-readable title */
    title: varchar("title", { length: 200 }).notNull(),
    /** Detailed description */
    description: text("description").notNull(),
    /** high | medium | low */
    priority: varchar("priority", { length: 10 }).notNull().default("medium"),
    /** Rule that triggered this recommendation (e.g. concentration_limit_breach) */
    triggerRule: varchar("trigger_rule", { length: 100 }),
    /** Entity this recommendation targets (e.g. strategy name or symbol) */
    targetEntity: varchar("target_entity", { length: 100 }),
    /** Supporting data for this recommendation */
    supportingData: jsonb("supporting_data"),
    /** Whether user has acknowledged / acted on this */
    isAcknowledged: boolean("is_acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    /** Whether this recommendation has been superseded by a newer one */
    isSuperseded: boolean("is_superseded").notNull().default(false),
    /** Display order within priority group */
    sortOrder: integer("sort_order").default(0),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_recommendations_account_idx").on(table.accountId),
    index("portfolio_recommendations_type_idx").on(table.recommendationType),
    index("portfolio_recommendations_priority_idx").on(table.priority),
    index("portfolio_recommendations_acknowledged_idx").on(table.isAcknowledged),
  ],
);

export const insertPortfolioRecommendationSchema = createInsertSchema(portfolioRecommendationsTable).omit({
  id: true,
  createdAt: true,
});
export const selectPortfolioRecommendationSchema = createSelectSchema(portfolioRecommendationsTable);

export type InsertPortfolioRecommendation = z.infer<typeof insertPortfolioRecommendationSchema>;
export type PortfolioRecommendation = typeof portfolioRecommendationsTable.$inferSelect;
