import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";

/**
 * Paper trading orders.
 * Simulates the order management lifecycle — no real broker involved.
 *
 * type: market | limit | stop | stop_limit
 * side: buy | sell
 * status: pending | submitted | partially_filled | filled | cancelled | rejected | expired
 *
 * Fill progress is tracked via filled_quantity.
 * Final state produces a record in paper_fills.
 */
export const paperOrdersTable = pgTable(
  "paper_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    /** Strategy that placed this order */
    strategyName: varchar("strategy_name", { length: 100 }),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** market | limit | stop | stop_limit */
    orderType: varchar("order_type", { length: 20 }).notNull(),
    /** buy | sell */
    side: varchar("side", { length: 10 }).notNull(),
    /** Requested quantity */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Quantity filled so far (for partial fills) */
    filledQuantity: numeric("filled_quantity", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Limit price (null for market orders) */
    limitPrice: numeric("limit_price", { precision: 20, scale: 8 }),
    /** Stop trigger price (for stop and stop_limit orders) */
    stopPrice: numeric("stop_price", { precision: 20, scale: 8 }),
    /** Average fill price (null until at least partially filled) */
    avgFillPrice: numeric("avg_fill_price", { precision: 20, scale: 8 }),
    /** pending | submitted | partially_filled | filled | cancelled | rejected | expired */
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    /** Reason for rejection if status = rejected */
    rejectReason: text("reject_reason"),
    /** Signal that triggered this order (BUY_SIGNAL, SELL_SIGNAL, etc.) */
    signal: varchar("signal", { length: 50 }),
    /** Market price at order creation time */
    marketPriceAtOrder: numeric("market_price_at_order", { precision: 20, scale: 8 }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    filledAt: timestamp("filled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_orders_account_id_idx").on(table.accountId),
    index("paper_orders_symbol_idx").on(table.symbol),
    index("paper_orders_status_idx").on(table.status),
    index("paper_orders_strategy_idx").on(table.strategyName),
    index("paper_orders_created_at_idx").on(table.createdAt),
  ],
);

export const insertPaperOrderSchema = createInsertSchema(paperOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPaperOrderSchema = createSelectSchema(paperOrdersTable);

export type InsertPaperOrder = z.infer<typeof insertPaperOrderSchema>;
export type PaperOrder = typeof paperOrdersTable.$inferSelect;
