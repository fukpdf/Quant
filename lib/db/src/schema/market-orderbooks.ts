import {
  pgTable,
  uuid,
  varchar,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** Single bid/ask level: [price, quantity] */
export type OrderBookLevel = [string, string];

/**
 * market_orderbooks — periodic order book snapshots.
 * Captures top-of-book and configurable depth levels per symbol.
 * Stored as JSONB arrays for compact representation.
 */
export const marketOrderbooksTable = pgTable(
  "market_orderbooks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Best bid price */
    bestBid: numeric("best_bid", { precision: 30, scale: 10 }),
    /** Best bid quantity */
    bestBidQty: numeric("best_bid_qty", { precision: 30, scale: 10 }),
    /** Best ask price */
    bestAsk: numeric("best_ask", { precision: 30, scale: 10 }),
    /** Best ask quantity */
    bestAskQty: numeric("best_ask_qty", { precision: 30, scale: 10 }),
    /** Spread = ask - bid */
    spread: numeric("spread", { precision: 30, scale: 10 }),
    /** Spread as % of mid price */
    spreadPct: numeric("spread_pct", { precision: 20, scale: 6 }),
    /** Order book imbalance: (bid_qty - ask_qty) / (bid_qty + ask_qty) */
    imbalance: numeric("imbalance", { precision: 10, scale: 6 }),
    /** Total bid liquidity in top N levels */
    bidLiquidity: numeric("bid_liquidity", { precision: 30, scale: 10 }),
    /** Total ask liquidity in top N levels */
    askLiquidity: numeric("ask_liquidity", { precision: 30, scale: 10 }),
    /** Bid depth levels: [[price, qty], ...] */
    bids: jsonb("bids").$type<OrderBookLevel[]>().default([]),
    /** Ask depth levels: [[price, qty], ...] */
    asks: jsonb("asks").$type<OrderBookLevel[]>().default([]),
    /** Depth levels captured (e.g. 10, 20) */
    depthLevels: numeric("depth_levels", { precision: 5, scale: 0 }),
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_orderbooks_symbol_idx").on(table.symbol),
    index("market_orderbooks_symbol_created_idx").on(table.symbol, table.createdAt),
    index("market_orderbooks_session_idx").on(table.sessionId),
  ],
);

export const insertMarketOrderbookSchema = createInsertSchema(marketOrderbooksTable).omit({
  id: true,
  createdAt: true,
});
export const selectMarketOrderbookSchema = createSelectSchema(marketOrderbooksTable);

export type InsertMarketOrderbook = z.infer<typeof insertMarketOrderbookSchema>;
export type MarketOrderbook = typeof marketOrderbooksTable.$inferSelect;
