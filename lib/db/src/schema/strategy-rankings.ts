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
 * strategy_rankings — multi-factor strategy ranking snapshots.
 *
 * Computed by the RankingEngine on a scheduled basis (daily/weekly/monthly).
 * Stores individual factor scores plus the composite weighted score and rank.
 *
 * ranking_period: daily | weekly | monthly | all_time
 */
export const strategyRankingsTable = pgTable(
  "strategy_rankings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Strategy being ranked */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** Linked backtest run ID (null = aggregate across all runs) */
    backtestRunId: uuid("backtest_run_id"),
    /** daily | weekly | monthly | all_time */
    rankingPeriod: varchar("ranking_period", { length: 20 }).notNull(),
    /** Symbol filter (null = all symbols aggregated) */
    symbol: varchar("symbol", { length: 30 }),
    // ---- Individual factor scores (higher = better, normalized 0–100) ----
    sharpeScore: numeric("sharpe_score", { precision: 8, scale: 4 }),
    sortinoScore: numeric("sortino_score", { precision: 8, scale: 4 }),
    calmarScore: numeric("calmar_score", { precision: 8, scale: 4 }),
    maxDrawdownScore: numeric("max_drawdown_score", { precision: 8, scale: 4 }),
    winRateScore: numeric("win_rate_score", { precision: 8, scale: 4 }),
    consistencyScore: numeric("consistency_score", { precision: 8, scale: 4 }),
    walkForwardScore: numeric("walk_forward_score", { precision: 8, scale: 4 }),
    monteCarloScore: numeric("monte_carlo_score", { precision: 8, scale: 4 }),
    // ---- Raw metric values for display ----
    sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 6 }),
    sortinoRatio: numeric("sortino_ratio", { precision: 10, scale: 6 }),
    calmarRatio: numeric("calmar_ratio", { precision: 10, scale: 6 }),
    maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 6 }),
    totalReturn: numeric("total_return", { precision: 10, scale: 6 }),
    winRate: numeric("win_rate", { precision: 8, scale: 6 }),
    tradeCount: integer("trade_count"),
    // ---- Composite ranking ----
    /** Weighted composite score 0–100 */
    compositeScore: numeric("composite_score", { precision: 8, scale: 4 }).notNull(),
    /** Rank position (1 = best) */
    rankPosition: integer("rank_position").notNull(),
    /** How many strategies were ranked in this computation */
    totalStrategies: integer("total_strategies").notNull(),
    /** Percentile 0–100 (100 = best) */
    percentile: numeric("percentile", { precision: 5, scale: 2 }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_rankings_strategy_name_idx").on(table.strategyName),
    index("strategy_rankings_period_idx").on(table.rankingPeriod),
    index("strategy_rankings_composite_idx").on(table.compositeScore),
    index("strategy_rankings_rank_idx").on(table.rankPosition),
    index("strategy_rankings_computed_at_idx").on(table.computedAt),
    index("strategy_rankings_period_rank_idx").on(table.rankingPeriod, table.rankPosition),
  ],
);

export const insertStrategyRankingSchema = createInsertSchema(strategyRankingsTable).omit({
  id: true,
  createdAt: true,
});

export const selectStrategyRankingSchema = createSelectSchema(strategyRankingsTable);

export type InsertStrategyRanking = z.infer<typeof insertStrategyRankingSchema>;
export type StrategyRanking = typeof strategyRankingsTable.$inferSelect;
