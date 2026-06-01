import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Computed strategy risk scores — derived from backtest performance history.
 * Evaluated periodically by the risk scheduler.
 * Used by the pre-trade risk engine to gate orders from poor-performing strategies.
 *
 * All scores 0–100 where 100 = best.
 */
export const strategyRiskScoresTable = pgTable(
  "strategy_risk_scores",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** Score based on win rate consistency across backtest runs */
    winRateScore: numeric("win_rate_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Score based on max drawdown stability across backtest runs */
    drawdownScore: numeric("drawdown_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Score based on Sharpe ratio across runs */
    sharpeScore: numeric("sharpe_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Score based on result consistency (low variance across runs) */
    consistencyScore: numeric("consistency_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Score based on trade frequency — too few or too many is penalized */
    tradeFrequencyScore: numeric("trade_frequency_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Score based on average position exposure % */
    exposureScore: numeric("exposure_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Weighted composite risk score (lower = riskier) */
    overallRiskScore: numeric("overall_risk_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Operational health: does the strategy produce signals? Is it generating errors? */
    healthScore: numeric("health_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Confidence in deployment: combination of backtest quality + consistency */
    confidenceScore: numeric("confidence_score", { precision: 6, scale: 2 }).notNull().default("50"),
    /** Number of completed backtest runs used in computation */
    sampleSize: integer("sample_size").notNull().default(0),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_risk_scores_name_idx").on(table.strategyName),
    index("strategy_risk_scores_calculated_at_idx").on(table.calculatedAt),
    index("strategy_risk_scores_overall_idx").on(table.overallRiskScore),
  ],
);

export const insertStrategyRiskScoreSchema = createInsertSchema(strategyRiskScoresTable).omit({
  id: true,
  createdAt: true,
});

export const selectStrategyRiskScoreSchema = createSelectSchema(strategyRiskScoresTable);

export type InsertStrategyRiskScore = z.infer<typeof insertStrategyRiskScoreSchema>;
export type StrategyRiskScore = typeof strategyRiskScoresTable.$inferSelect;
