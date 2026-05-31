import {
  pgTable,
  bigserial,
  varchar,
  numeric,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const candlesTable = pgTable(
  "candles",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    open: numeric("open", { precision: 20, scale: 8 }).notNull(),
    high: numeric("high", { precision: 20, scale: 8 }).notNull(),
    low: numeric("low", { precision: 20, scale: 8 }).notNull(),
    close: numeric("close", { precision: 20, scale: 8 }).notNull(),
    volume: numeric("volume", { precision: 30, scale: 8 }).notNull(),
    interval: varchar("interval", { length: 10 }).notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("candles_symbol_interval_timestamp_uidx").on(
      table.symbol,
      table.interval,
      table.timestamp,
    ),
    index("candles_symbol_interval_idx").on(table.symbol, table.interval),
    index("candles_timestamp_idx").on(table.timestamp),
  ],
);

export const insertCandleSchema = createInsertSchema(candlesTable).omit({
  id: true,
  createdAt: true,
});

export const selectCandleSchema = createSelectSchema(candlesTable);

export type InsertCandle = z.infer<typeof insertCandleSchema>;
export type Candle = typeof candlesTable.$inferSelect;
