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
 * Paper trading positions — both open and closed.
 *
 * status: open | closed
 * side: long | short
 *
 * Positions are created when an order fills.
 * closedAt / exitPrice / realizedPnl are populated when the position is closed.
 */
export const paperPositionsTable = pgTable(
  "paper_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    /** Strategy that opened this position, e.g. "ema_crossover" */
    strategyName: varchar("strategy_name", { length: 100 }),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** long | short */
    side: varchar("side", { length: 10 }).notNull(),
    /** open | closed */
    status: varchar("status", { length: 20 }).notNull().default("open"),
    /** Number of units (base currency) */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Simulated average entry price (post-slippage) */
    entryPrice: numeric("entry_price", { precision: 20, scale: 8 }).notNull(),
    /** Last known market price (updated during mark-to-market cycle) */
    currentPrice: numeric("current_price", { precision: 20, scale: 8 }).notNull(),
    /** Exit price when closed */
    exitPrice: numeric("exit_price", { precision: 20, scale: 8 }),
    /** Market value of position = quantity × currentPrice */
    marketValue: numeric("market_value", { precision: 20, scale: 8 }).notNull(),
    /** Unrealized PnL = (currentPrice - entryPrice) × quantity for longs */
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Realized PnL when closed */
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }),
    /** Total commission paid for this position */
    commission: numeric("commission", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Total slippage impact for this position */
    slippage: numeric("slippage", { precision: 20, scale: 8 }).notNull().default("0"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_positions_account_id_idx").on(table.accountId),
    index("paper_positions_symbol_idx").on(table.symbol),
    index("paper_positions_status_idx").on(table.status),
    index("paper_positions_strategy_idx").on(table.strategyName),
    index("paper_positions_opened_at_idx").on(table.openedAt),
  ],
);

export const insertPaperPositionSchema = createInsertSchema(paperPositionsTable).omit({
  id: true,
  openedAt: true,
  updatedAt: true,
});

export const selectPaperPositionSchema = createSelectSchema(paperPositionsTable);

export type InsertPaperPosition = z.infer<typeof insertPaperPositionSchema>;
export type PaperPosition = typeof paperPositionsTable.$inferSelect;
