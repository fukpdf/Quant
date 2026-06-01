import {
  pgTable,
  uuid,
  numeric,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestRunsTable } from "./backtest-runs";

/**
 * Aggregated performance metrics for a completed backtest run.
 * One row per backtest_run (1:1 relationship enforced by unique index).
 * All percentage fields are stored as decimal fractions (0.15 = 15%).
 */
export const performanceMetricsTable = pgTable(
  "performance_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    backtestRunId: uuid("backtest_run_id")
      .notNull()
      .references(() => backtestRunsTable.id),
    /** Net return over the entire backtest period as a decimal fraction */
    totalReturnPct: numeric("total_return_pct", { precision: 12, scale: 8 }).notNull(),
    /** Annualized return as a decimal fraction (null if period < 1 year) */
    annualizedReturnPct: numeric("annualized_return_pct", { precision: 12, scale: 8 }),
    /** Fraction of trades that were profitable: winners / total */
    winRate: numeric("win_rate", { precision: 8, scale: 6 }).notNull(),
    /** Gross profit / gross loss; null if no losing trades */
    profitFactor: numeric("profit_factor", { precision: 12, scale: 6 }),
    /** Average winning trade return as a decimal fraction */
    avgWinPct: numeric("avg_win_pct", { precision: 12, scale: 8 }),
    /** Average losing trade return as a decimal fraction (stored as negative) */
    avgLossPct: numeric("avg_loss_pct", { precision: 12, scale: 8 }),
    /** Maximum peak-to-trough drawdown as a decimal fraction */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 8 }).notNull(),
    /** Annualized (return - risk_free) / std_dev of returns */
    sharpeRatio: numeric("sharpe_ratio", { precision: 12, scale: 6 }),
    /** Like Sharpe but penalises only downside deviation */
    sortinoRatio: numeric("sortino_ratio", { precision: 12, scale: 6 }),
    totalTrades: integer("total_trades").notNull(),
    winningTrades: integer("winning_trades").notNull(),
    losingTrades: integer("losing_trades").notNull(),
    /** Average expected return per trade (avgWin*winRate + avgLoss*(1-winRate)) */
    expectancy: numeric("expectancy", { precision: 12, scale: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("performance_metrics_run_id_uidx").on(table.backtestRunId),
  ],
);

export const insertPerformanceMetricsSchema = createInsertSchema(
  performanceMetricsTable,
).omit({ id: true, createdAt: true });

export const selectPerformanceMetricsSchema = createSelectSchema(performanceMetricsTable);

export type InsertPerformanceMetrics = z.infer<typeof insertPerformanceMetricsSchema>;
export type PerformanceMetrics = typeof performanceMetricsTable.$inferSelect;
