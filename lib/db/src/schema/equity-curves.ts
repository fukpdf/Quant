import {
  pgTable,
  uuid,
  numeric,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestRunsTable } from "./backtest-runs";
import { portfolioBacktestsTable } from "./portfolio-backtests";

/**
 * Stored equity curves for backtests and portfolio runs.
 *
 * Each row represents the full time-series of one run, stored as a
 * compact JSON array in curveData:
 *   [{ t: epoch_ms, e: equity, c: cash?, d: drawdownPct? }, ...]
 *
 * Keeping the series in a single row avoids a separate wide table with
 * potentially tens of thousands of rows per backtest.
 */
export const equityCurvesTable = pgTable(
  "equity_curves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** FK to a single-strategy backtest run (nullable if portfolio) */
    backtestRunId: uuid("backtest_run_id").references(() => backtestRunsTable.id),
    /** FK to a portfolio backtest run (nullable if single-strategy) */
    portfolioBacktestId: uuid("portfolio_backtest_id").references(() => portfolioBacktestsTable.id),
    /**
     * Compact JSON array of equity curve points.
     * Each point: { t: number (ms), e: number (equity), d: number (drawdownPct) }
     */
    curveData: text("curve_data").notNull(),
    totalPoints: integer("total_points").notNull(),
    startEquity: numeric("start_equity", { precision: 16, scale: 4 }).notNull(),
    endEquity: numeric("end_equity", { precision: 16, scale: 4 }).notNull(),
    peakEquity: numeric("peak_equity", { precision: 16, scale: 4 }).notNull(),
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 8 }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("equity_curves_run_id_idx").on(table.backtestRunId),
    index("equity_curves_portfolio_id_idx").on(table.portfolioBacktestId),
    index("equity_curves_generated_at_idx").on(table.generatedAt),
  ],
);

export const insertEquityCurveSchema = createInsertSchema(equityCurvesTable).omit({ id: true });
export const selectEquityCurveSchema = createSelectSchema(equityCurvesTable);

export type InsertEquityCurve = z.infer<typeof insertEquityCurveSchema>;
export type EquityCurve = typeof equityCurvesTable.$inferSelect;
