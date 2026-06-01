import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";

/**
 * Completed trade history — one row per round-trip trade (entry + exit).
 * Created when a position is closed.
 * Provides a clean audit trail of every completed trade.
 */
export const paperTradeHistoryTable = pgTable(
  "paper_trade_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    /** Strategy responsible for this trade */
    strategyName: varchar("strategy_name", { length: 100 }),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** long | short */
    side: varchar("side", { length: 10 }).notNull(),
    /** Quantity traded */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Average entry price */
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    /** Average exit price */
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }).notNull(),
    /** Gross PnL before costs */
    grossPnl: numeric("gross_pnl", { precision: 20, scale: 8 }).notNull(),
    /** Net PnL after commission and slippage */
    netPnl: numeric("net_pnl", { precision: 20, scale: 8 }).notNull(),
    /** Return as decimal fraction */
    returnPct: numeric("return_pct", { precision: 12, scale: 8 }).notNull(),
    /** Total commission paid */
    commission: numeric("commission", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Total slippage impact */
    slippage: numeric("slippage", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Holding duration in minutes */
    holdingMinutes: numeric("holding_minutes", { precision: 12, scale: 2 }),
    entrySignal: varchar("entry_signal", { length: 50 }),
    exitSignal: varchar("exit_signal", { length: 50 }),
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull(),
    exitedAt: timestamp("exited_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_trade_history_account_id_idx").on(table.accountId),
    index("paper_trade_history_symbol_idx").on(table.symbol),
    index("paper_trade_history_strategy_idx").on(table.strategyName),
    index("paper_trade_history_exited_at_idx").on(table.exitedAt),
  ],
);

export const insertPaperTradeHistorySchema = createInsertSchema(paperTradeHistoryTable).omit({
  id: true,
  createdAt: true,
});

export const selectPaperTradeHistorySchema = createSelectSchema(paperTradeHistoryTable);

export type InsertPaperTradeHistory = z.infer<typeof insertPaperTradeHistorySchema>;
export type PaperTradeHistory = typeof paperTradeHistoryTable.$inferSelect;
