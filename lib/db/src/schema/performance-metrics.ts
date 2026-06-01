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
 * Phase 4 adds: calmarRatio, recoveryFactor, ulcerIndex, marRatio,
 *               exposureTimePct, avgTradeDurationDays, ulcerPerformanceIndex,
 *               probabilityOfRuin, totalCommission, totalSlippage.
 */
export const performanceMetricsTable = pgTable(
  "performance_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    backtestRunId: uuid("backtest_run_id")
      .notNull()
      .references(() => backtestRunsTable.id),
    // --- Phase 3 metrics ---
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
    // --- Phase 4 additions ---
    /** CAGR / maxDrawdown */
    calmarRatio: numeric("calmar_ratio", { precision: 12, scale: 6 }),
    /** totalReturn / maxDrawdown */
    recoveryFactor: numeric("recovery_factor", { precision: 12, scale: 6 }),
    /** RMS of drawdown time-series */
    ulcerIndex: numeric("ulcer_index", { precision: 12, scale: 8 }),
    /** CAGR / maxDrawdown (MAR convention, same as Calmar here) */
    marRatio: numeric("mar_ratio", { precision: 12, scale: 6 }),
    /** Fraction of candles with an open position */
    exposureTimePct: numeric("exposure_time_pct", { precision: 8, scale: 6 }),
    /** Average trade duration in calendar days */
    avgTradeDurationDays: numeric("avg_trade_duration_days", { precision: 10, scale: 4 }),
    /** Return / Ulcer Index */
    ulcerPerformanceIndex: numeric("ulcer_performance_index", { precision: 12, scale: 6 }),
    /** Populated by Monte Carlo simulation (null until MC is run) */
    probabilityOfRuin: numeric("probability_of_ruin", { precision: 8, scale: 6 }),
    /** Total commission paid across all trades (quote currency) */
    totalCommission: numeric("total_commission", { precision: 16, scale: 8 }).notNull().default("0"),
    /** Total slippage across all trades (quote currency) */
    totalSlippage: numeric("total_slippage", { precision: 16, scale: 8 }).notNull().default("0"),
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
