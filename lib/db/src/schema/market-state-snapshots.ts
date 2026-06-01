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

/**
 * market_state_snapshots — periodic snapshots of the in-memory market state engine.
 * The in-memory state is always authoritative; snapshots persist it for analytics and replay.
 */
export const marketStateSnapshotsTable = pgTable(
  "market_state_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Last trade price */
    lastPrice: numeric("last_price", { precision: 30, scale: 10 }),
    /** Best bid */
    bidPrice: numeric("bid_price", { precision: 30, scale: 10 }),
    /** Best ask */
    askPrice: numeric("ask_price", { precision: 30, scale: 10 }),
    /** Current spread */
    spread: numeric("spread", { precision: 30, scale: 10 }),
    /** Volume-Weighted Average Price (rolling window) */
    vwap: numeric("vwap", { precision: 30, scale: 10 }),
    /** Cumulative volume in rolling window */
    volume: numeric("volume", { precision: 30, scale: 10 }),
    /** Cumulative quote volume */
    quoteVolume: numeric("quote_volume", { precision: 30, scale: 10 }),
    /** Price change % over rolling 24h */
    priceChangePercent: numeric("price_change_percent", { precision: 20, scale: 6 }),
    /** Short-term momentum indicator (-1 to +1) */
    momentum: numeric("momentum", { precision: 10, scale: 6 }),
    /** Rolling volatility (std dev of returns) */
    volatility: numeric("volatility", { precision: 10, scale: 6 }),
    /** Order book imbalance (-1 to +1) */
    imbalance: numeric("imbalance", { precision: 10, scale: 6 }),
    /** open | closed | halted | pre_market | after_hours */
    marketStatus: varchar("market_status", { length: 30 }).default("open"),
    /** Tick count in rolling window */
    tickCount: numeric("tick_count", { precision: 15, scale: 0 }).default("0"),
    /** Ticks per second (rolling 60s) */
    ticksPerSecond: numeric("ticks_per_second", { precision: 10, scale: 2 }),
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_state_symbol_idx").on(table.symbol),
    index("market_state_symbol_created_idx").on(table.symbol, table.createdAt),
  ],
);

export const insertMarketStateSnapshotSchema = createInsertSchema(marketStateSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export const selectMarketStateSnapshotSchema = createSelectSchema(marketStateSnapshotsTable);

export type InsertMarketStateSnapshot = z.infer<typeof insertMarketStateSnapshotSchema>;
export type MarketStateSnapshot = typeof marketStateSnapshotsTable.$inferSelect;
