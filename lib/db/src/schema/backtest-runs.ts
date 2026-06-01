import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * One row per backtest run.
 * Tracks the full lifecycle: pending → running → completed | failed.
 * parameters stores the JSON-serialized strategy configuration used for this run.
 * Results (trades, metrics) are stored in separate tables referencing this id.
 */
export const backtestRunsTable = pgTable(
  "backtest_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The strategy name key (e.g. "ema_crossover") */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    interval: varchar("interval", { length: 10 }).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    /** JSON-serialized strategy parameters */
    parameters: text("parameters").notNull(),
    /** pending | running | completed | failed */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    candlesProcessed: integer("candles_processed").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("backtest_runs_strategy_idx").on(table.strategyName),
    index("backtest_runs_symbol_interval_idx").on(table.symbol, table.interval),
    index("backtest_runs_status_idx").on(table.status),
    index("backtest_runs_created_at_idx").on(table.createdAt),
  ],
);

export const insertBacktestRunSchema = createInsertSchema(backtestRunsTable).omit({
  id: true,
  createdAt: true,
});

export const selectBacktestRunSchema = createSelectSchema(backtestRunsTable);

export type InsertBacktestRun = z.infer<typeof insertBacktestRunSchema>;
export type BacktestRun = typeof backtestRunsTable.$inferSelect;
