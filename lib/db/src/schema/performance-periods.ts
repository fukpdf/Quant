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
 * performance_periods — aggregated performance metrics for a calendar period.
 * Enables monthly/quarterly/yearly performance table views.
 * One row per account per period type per period value.
 */
export const performancePeriodsTable = pgTable(
  "performance_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** daily | weekly | monthly | quarterly | yearly */
    periodType: varchar("period_type", { length: 20 }).notNull(),
    /** Human label: "2026-05", "2026-Q1", "2026" etc */
    periodLabel: varchar("period_label", { length: 20 }).notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Return % */
    returnPct: numeric("return_pct", { precision: 12, scale: 6 }),
    /** Net return % (after commissions/slippage) */
    netReturnPct: numeric("net_return_pct", { precision: 12, scale: 6 }),
    /** Starting equity */
    startEquity: numeric("start_equity", { precision: 18, scale: 8 }),
    /** Ending equity */
    endEquity: numeric("end_equity", { precision: 18, scale: 8 }),
    /** P&L */
    pnl: numeric("pnl", { precision: 18, scale: 8 }),
    /** Max drawdown in period (%) */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 6 }),
    /** Volatility in period (%) */
    volatilityPct: numeric("volatility_pct", { precision: 12, scale: 6 }),
    /** Sharpe ratio for period */
    sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 6 }),
    /** Trade count */
    tradeCount: integer("trade_count").default(0),
    /** Win rate (%) */
    winRatePct: numeric("win_rate_pct", { precision: 8, scale: 4 }),
    /** Benchmark return for comparison (%) */
    benchmarkReturnPct: numeric("benchmark_return_pct", { precision: 12, scale: 6 }),
    /** Excess return vs benchmark (%) */
    excessReturnPct: numeric("excess_return_pct", { precision: 12, scale: 6 }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("performance_periods_account_type_idx").on(table.accountId, table.periodType),
    index("performance_periods_account_idx").on(table.accountId),
    index("performance_periods_period_start_idx").on(table.periodStart),
  ],
);

export const insertPerformancePeriodSchema = createInsertSchema(performancePeriodsTable).omit({
  id: true,
  createdAt: true,
});
export const selectPerformancePeriodSchema = createSelectSchema(performancePeriodsTable);

export type InsertPerformancePeriod = z.infer<typeof insertPerformancePeriodSchema>;
export type PerformancePeriod = typeof performancePeriodsTable.$inferSelect;
