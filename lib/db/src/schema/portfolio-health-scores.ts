import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * portfolio_health_scores — periodic health scores for a paper account.
 * Scores 0–100 across 5 dimensions + overall. Graded A–F.
 */
export const portfolioHealthScoresTable = pgTable(
  "portfolio_health_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** Snapshot timestamp */
    scoredAt: timestamp("scored_at", { withTimezone: true }).notNull().defaultNow(),
    /** Performance score (0–100): based on returns vs benchmark/expectations */
    performanceScore: numeric("performance_score", { precision: 6, scale: 2 }),
    /** Risk score (0–100): based on drawdown, volatility, Sharpe */
    riskScore: numeric("risk_score", { precision: 6, scale: 2 }),
    /** Diversification score (0–100): asset spread, correlation, concentration */
    diversificationScore: numeric("diversification_score", { precision: 6, scale: 2 }),
    /** Consistency score (0–100): return stability, low variance, regular wins */
    consistencyScore: numeric("consistency_score", { precision: 6, scale: 2 }),
    /** Capital efficiency score (0–100): return per unit of capital employed */
    capitalEfficiencyScore: numeric("capital_efficiency_score", { precision: 6, scale: 2 }),
    /** Overall health score (weighted average of above, 0–100) */
    overallScore: numeric("overall_score", { precision: 6, scale: 2 }).notNull(),
    /** Letter grade: A | B | C | D | F */
    grade: varchar("grade", { length: 1 }).notNull(),
    /** Detailed sub-scores and contributing metrics */
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_health_scores_account_idx").on(table.accountId),
    index("portfolio_health_scores_scored_at_idx").on(table.scoredAt),
  ],
);

export const insertPortfolioHealthScoreSchema = createInsertSchema(portfolioHealthScoresTable).omit({
  id: true,
  createdAt: true,
});
export const selectPortfolioHealthScoreSchema = createSelectSchema(portfolioHealthScoresTable);

export type InsertPortfolioHealthScore = z.infer<typeof insertPortfolioHealthScoreSchema>;
export type PortfolioHealthScore = typeof portfolioHealthScoresTable.$inferSelect;
