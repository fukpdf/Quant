import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Results of data quality validation runs.
 * Each row represents one check type for one symbol+interval at one point in time.
 *
 * Check types:
 *   missing_candles     — expected candles absent from the range
 *   timestamp_gaps      — non-uniform time intervals between candles
 *   duplicate_candles   — multiple candles sharing a timestamp
 *   outlier_prices      — OHLCV values statistically anomalous vs neighbours
 *   invalid_volumes     — zero or negative volume where non-zero expected
 *   future_timestamps   — candles with timestamp > now()
 *   ohlc_consistency    — high < low, high < close, etc.
 */
export const dataQualityChecksTable = pgTable(
  "data_quality_checks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    interval: varchar("interval", { length: 10 }).notNull(),
    /** See jsdoc above for valid check types */
    checkType: varchar("check_type", { length: 50 }).notNull(),
    /** pass | fail | warning */
    status: varchar("status", { length: 20 }).notNull(),
    candleCount: integer("candle_count").notNull().default(0),
    issueCount: integer("issue_count").notNull().default(0),
    /** JSON blob with structured details (affected timestamps, values, etc.) */
    details: text("details"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("dqc_symbol_interval_idx").on(table.symbol, table.interval),
    index("dqc_check_type_idx").on(table.checkType),
    index("dqc_status_idx").on(table.status),
    index("dqc_checked_at_idx").on(table.checkedAt),
  ],
);

export const insertDataQualityCheckSchema = createInsertSchema(
  dataQualityChecksTable,
).omit({ id: true, createdAt: true });

export const selectDataQualityCheckSchema =
  createSelectSchema(dataQualityChecksTable);

export type InsertDataQualityCheck = z.infer<typeof insertDataQualityCheckSchema>;
export type DataQualityCheck = typeof dataQualityChecksTable.$inferSelect;
