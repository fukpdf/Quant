import {
  pgTable,
  uuid,
  varchar,
  numeric,
  bigint,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * market_trades — individual trade events received from streaming providers.
 * Distinct from backtest/paper trades — these are real exchange-level executions
 * used for VWAP, liquidity analysis, and order flow.
 */
export const marketTradesTable = pgTable(
  "market_trades",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Exchange-assigned trade ID */
    tradeId: varchar("trade_id", { length: 50 }),
    /** Trade execution price */
    price: numeric("price", { precision: 30, scale: 10 }).notNull(),
    /** Trade quantity */
    quantity: numeric("quantity", { precision: 30, scale: 10 }).notNull(),
    /** Quote quantity = price × quantity */
    quoteQuantity: numeric("quote_quantity", { precision: 30, scale: 10 }),
    /** Buyer is market maker (true = sell trade, false = buy trade) */
    isBuyerMaker: boolean("is_buyer_maker"),
    /** Exchange-side trade timestamp (ms) */
    exchangeTimestamp: bigint("exchange_timestamp", { mode: "number" }),
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_trades_symbol_idx").on(table.symbol),
    index("market_trades_symbol_created_idx").on(table.symbol, table.createdAt),
    index("market_trades_session_idx").on(table.sessionId),
  ],
);

export const insertMarketTradeSchema = createInsertSchema(marketTradesTable).omit({
  id: true,
  createdAt: true,
});
export const selectMarketTradeSchema = createSelectSchema(marketTradesTable);

export type InsertMarketTrade = z.infer<typeof insertMarketTradeSchema>;
export type MarketTrade = typeof marketTradesTable.$inferSelect;
