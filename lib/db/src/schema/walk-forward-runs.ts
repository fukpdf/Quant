import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Walk-forward validation runs.
 *
 * A walk-forward test splits the historical data window into a series of
 * in-sample (IS) / out-of-sample (OOS) sub-periods and checks whether
 * the strategy's OOS performance is consistent with its IS performance.
 *
 * windowResults: JSON array of per-window outcomes:
 *   [{ windowIndex, isStart, isEnd, oosStart, oosEnd,
 *      isTotalReturnPct, oosTotalReturnPct, isSharpe, oosSharpe,
 *      isTrades, oosTrades }]
 */
export const walkForwardRunsTable = pgTable(
  "walk_forward_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    interval: varchar("interval", { length: 10 }).notNull(),
    fullStartDate: timestamp("full_start_date", { withTimezone: true }).notNull(),
    fullEndDate: timestamp("full_end_date", { withTimezone: true }).notNull(),
    parameters: text("parameters").notNull(),
    initialCapital: numeric("initial_capital", { precision: 16, scale: 4 }).notNull(),
    /** Fraction of each window used for in-sample (0.7 = 70%) */
    inSamplePct: numeric("in_sample_pct", { precision: 6, scale: 4 }).notNull(),
    /** Number of walk-forward windows */
    windowCount: integer("window_count").notNull(),
    /** rolling: fixed-size windows that slide; expanding: start fixed, end grows */
    windowType: varchar("window_type", { length: 20 }).notNull().default("rolling"),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** JSON array of per-window results */
    windowResults: text("window_results"),
    /** Average OOS total return across all windows */
    avgOosReturnPct: numeric("avg_oos_return_pct", { precision: 12, scale: 8 }),
    /** Average IS total return across all windows */
    avgIsReturnPct: numeric("avg_is_return_pct", { precision: 12, scale: 8 }),
    /** Ratio avg_oos / avg_is — 1.0 = perfect consistency, < 0 = overfitted */
    consistencyScore: numeric("consistency_score", { precision: 12, scale: 6 }),
    /** True if enough windows had positive OOS return */
    passedValidation: boolean("passed_validation"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("walk_forward_strategy_idx").on(table.strategyName),
    index("walk_forward_symbol_idx").on(table.symbol),
    index("walk_forward_status_idx").on(table.status),
    index("walk_forward_created_at_idx").on(table.createdAt),
  ],
);

export const insertWalkForwardRunSchema = createInsertSchema(walkForwardRunsTable).omit({
  id: true,
  createdAt: true,
});
export const selectWalkForwardRunSchema = createSelectSchema(walkForwardRunsTable);

export type InsertWalkForwardRun = z.infer<typeof insertWalkForwardRunSchema>;
export type WalkForwardRun = typeof walkForwardRunsTable.$inferSelect;
