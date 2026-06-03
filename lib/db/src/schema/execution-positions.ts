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
import { executionAccountsTable } from "./execution-accounts";

/**
 * Execution positions — tracks open and closed positions from execution fills.
 *
 * A position is opened by a fill and closed when quantity reaches zero.
 * Realized PnL is computed at close; unrealized PnL is updated on mark-to-market.
 *
 * status: open | closed
 * side: long | short
 */
export const executionPositionsTable = pgTable(
  "execution_positions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => executionAccountsTable.id),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** long | short */
    side: varchar("side", { length: 10 }).notNull(),
    /** Current open quantity */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Volume-weighted average entry price */
    avgEntryPrice: numeric("avg_entry_price", { precision: 20, scale: 8 }).notNull(),
    /** Latest mark price for unrealized PnL computation */
    currentPrice: numeric("current_price", { precision: 20, scale: 8 }),
    /** Unrealized PnL at latest mark price */
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 8 }),
    /** Realized PnL (accumulated from all closes) */
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Total commission paid to open + close this position */
    totalCommission: numeric("total_commission", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Total notional value at entry */
    notionalValue: numeric("notional_value", { precision: 20, scale: 8 }),
    /** open | closed */
    status: varchar("status", { length: 10 }).notNull().default("open"),
    /** Order that opened this position */
    openOrderId: uuid("open_order_id"),
    /** Order that closed this position (null if still open) */
    closeOrderId: uuid("close_order_id"),
    /** Strategy that originated this position */
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Execution mode: simulation | paper | live_disabled */
    executionMode: varchar("execution_mode", { length: 20 }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_positions_account_id_idx").on(table.accountId),
    index("exec_positions_symbol_idx").on(table.symbol),
    index("exec_positions_status_idx").on(table.status),
    index("exec_positions_mode_idx").on(table.executionMode),
    index("exec_positions_strategy_idx").on(table.strategyName),
    index("exec_positions_opened_at_idx").on(table.openedAt),
  ],
);

export const insertExecutionPositionSchema = createInsertSchema(executionPositionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectExecutionPositionSchema = createSelectSchema(executionPositionsTable);

export type InsertExecutionPosition = z.infer<typeof insertExecutionPositionSchema>;
export type ExecutionPosition = typeof executionPositionsTable.$inferSelect;
