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
 * portfolio_performance — time-windowed return metrics for a paper account.
 * Stores TWR, MWR, and period returns (daily/weekly/monthly/quarterly/yearly/YTD).
 * One row per account per period per window.
 */
export const portfolioPerformanceTable = pgTable(
  "portfolio_performance",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** daily | weekly | monthly | quarterly | yearly | ytd | cumulative | rolling_7d | rolling_30d | rolling_90d */
    period: varchar("period", { length: 30 }).notNull(),
    /** Period start date */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    /** Period end date */
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Time Weighted Return (%) */
    timeWeightedReturnPct: numeric("time_weighted_return_pct", { precision: 12, scale: 6 }),
    /** Money Weighted Return / IRR (%) */
    moneyWeightedReturnPct: numeric("money_weighted_return_pct", { precision: 12, scale: 6 }),
    /** Simple return (end/start - 1) (%) */
    simpleReturnPct: numeric("simple_return_pct", { precision: 12, scale: 6 }),
    /** Gross return before costs (%) */
    grossReturnPct: numeric("gross_return_pct", { precision: 12, scale: 6 }),
    /** Net return after all costs (%) */
    netReturnPct: numeric("net_return_pct", { precision: 12, scale: 6 }),
    /** Cumulative return since inception (%) */
    cumulativeReturnPct: numeric("cumulative_return_pct", { precision: 12, scale: 6 }),
    /** Alpha vs benchmark (if benchmark set) */
    alpha: numeric("alpha", { precision: 12, scale: 6 }),
    /** Beta vs benchmark */
    beta: numeric("beta", { precision: 12, scale: 6 }),
    /** Information ratio */
    informationRatio: numeric("information_ratio", { precision: 10, scale: 6 }),
    /** Treynor ratio */
    treynorRatio: numeric("treynor_ratio", { precision: 10, scale: 6 }),
    /** Jensen's alpha */
    jensensAlpha: numeric("jensens_alpha", { precision: 12, scale: 6 }),
    /** Tracking error vs benchmark (%) */
    trackingErrorPct: numeric("tracking_error_pct", { precision: 12, scale: 6 }),
    /** Active return (portfolio return - benchmark return) (%) */
    activeReturnPct: numeric("active_return_pct", { precision: 12, scale: 6 }),
    /** Upside capture ratio (%) */
    upsideCapturePct: numeric("upside_capture_pct", { precision: 10, scale: 4 }),
    /** Downside capture ratio (%) */
    downsideCapturePct: numeric("downside_capture_pct", { precision: 10, scale: 4 }),
    /** Benchmark ID used for alpha/beta calcs */
    benchmarkId: uuid("benchmark_id"),
    /** Benchmark return for this period (%) */
    benchmarkReturnPct: numeric("benchmark_return_pct", { precision: 12, scale: 6 }),
    /** Start equity value */
    startEquity: numeric("start_equity", { precision: 18, scale: 8 }),
    /** End equity value */
    endEquity: numeric("end_equity", { precision: 18, scale: 8 }),
    /** Rolling return data points (compact JSON array) */
    rollingReturns: jsonb("rolling_returns"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_performance_account_period_idx").on(table.accountId, table.period),
    index("portfolio_performance_account_idx").on(table.accountId),
    index("portfolio_performance_period_start_idx").on(table.periodStart),
  ],
);

export const insertPortfolioPerformanceSchema = createInsertSchema(portfolioPerformanceTable).omit({
  id: true,
  createdAt: true,
});
export const selectPortfolioPerformanceSchema = createSelectSchema(portfolioPerformanceTable);

export type InsertPortfolioPerformance = z.infer<typeof insertPortfolioPerformanceSchema>;
export type PortfolioPerformance = typeof portfolioPerformanceTable.$inferSelect;
