import {
  pgTable,
  uuid,
  varchar,
  numeric,
  bigint,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * market_ticks — real-time tick data from streaming providers.
 * High-volume table; indexed on symbol + exchangeTimestamp for efficient range queries.
 * Stored as numeric strings (consistent with platform convention — ADR-013).
 */
export const marketTicksTable = pgTable(
  "market_ticks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Market symbol e.g. "BTCUSDT" */
    symbol: varchar("symbol", { length: 20 }).notNull(),
    /** Stream provider e.g. "binance", "mock" */
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Last trade price */
    price: numeric("price", { precision: 30, scale: 10 }).notNull(),
    /** Best bid price */
    bidPrice: numeric("bid_price", { precision: 30, scale: 10 }),
    /** Best ask price */
    askPrice: numeric("ask_price", { precision: 30, scale: 10 }),
    /** Bid-ask spread */
    spread: numeric("spread", { precision: 30, scale: 10 }),
    /** Trade volume at this tick */
    volume: numeric("volume", { precision: 30, scale: 10 }),
    /** Quote asset volume */
    quoteVolume: numeric("quote_volume", { precision: 30, scale: 10 }),
    /** 24h price change % */
    priceChangePercent: numeric("price_change_percent", { precision: 20, scale: 6 }),
    /** Exchange-side timestamp (ms since epoch) */
    exchangeTimestamp: bigint("exchange_timestamp", { mode: "number" }),
    /** Stream session that delivered this tick */
    sessionId: uuid("session_id"),
    /** Processing latency ms (exchange → storage) */
    latencyMs: numeric("latency_ms", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_ticks_symbol_idx").on(table.symbol),
    index("market_ticks_symbol_created_idx").on(table.symbol, table.createdAt),
    index("market_ticks_provider_idx").on(table.provider),
    index("market_ticks_session_idx").on(table.sessionId),
  ],
);

export const insertMarketTickSchema = createInsertSchema(marketTicksTable).omit({
  id: true,
  createdAt: true,
});
export const selectMarketTickSchema = createSelectSchema(marketTicksTable);

export type InsertMarketTick = z.infer<typeof insertMarketTickSchema>;
export type MarketTick = typeof marketTicksTable.$inferSelect;
