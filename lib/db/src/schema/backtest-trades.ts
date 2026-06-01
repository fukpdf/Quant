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
import { backtestRunsTable } from "./backtest-runs";

/**
 * Simulated trades produced by the backtesting engine.
 * Each row is one completed round-trip trade (entry + exit).
 * Open (not yet closed) positions at end of backtest are still recorded with null exit fields.
 * All prices are stored as text to preserve full decimal precision.
 */
export const backtestTradesTable = pgTable(
  "backtest_trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    backtestRunId: uuid("backtest_run_id")
      .notNull()
      .references(() => backtestRunsTable.id),
    /** BUY | SELL (direction of the opening leg) */
    side: varchar("side", { length: 10 }).notNull(),
    entryTime: timestamp("entry_time", { withTimezone: true }).notNull(),
    exitTime: timestamp("exit_time", { withTimezone: true }),
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Absolute P&L in base currency units */
    pnl: numeric("pnl", { precision: 20, scale: 8 }),
    /** P&L as percentage of entry value */
    pnlPct: numeric("pnl_pct", { precision: 10, scale: 6 }),
    /** Signal that triggered the entry (e.g. "EMA_CROSS_UP") */
    entrySignal: varchar("entry_signal", { length: 100 }).notNull(),
    /** Signal that triggered the exit (null if position still open) */
    exitSignal: varchar("exit_signal", { length: 100 }),
    /** Ordinal index of the candle at entry within the backtest window */
    candleIndexEntry: integer("candle_index_entry").notNull(),
    candleIndexExit: integer("candle_index_exit"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("backtest_trades_run_id_idx").on(table.backtestRunId),
    index("backtest_trades_entry_time_idx").on(table.entryTime),
    index("backtest_trades_side_idx").on(table.side),
  ],
);

export const insertBacktestTradeSchema = createInsertSchema(backtestTradesTable).omit({
  id: true,
  createdAt: true,
});

export const selectBacktestTradeSchema = createSelectSchema(backtestTradesTable);

export type InsertBacktestTrade = z.infer<typeof insertBacktestTradeSchema>;
export type BacktestTrade = typeof backtestTradesTable.$inferSelect;
