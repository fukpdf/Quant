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
 * latency_metrics — individual latency measurements across the streaming pipeline.
 * Captures each stage: provider → receive → process → store → publish.
 */
export const latencyMetricsTable = pgTable(
  "latency_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull(),
    symbol: varchar("symbol", { length: 20 }),
    /** provider_latency | processing_latency | storage_latency | queue_latency | end_to_end */
    metricType: varchar("metric_type", { length: 50 }).notNull(),
    /** Measured value in milliseconds */
    valueMs: numeric("value_ms", { precision: 10, scale: 3 }).notNull(),
    /** Exchange timestamp (ms) — when event occurred at exchange */
    exchangeTimestampMs: numeric("exchange_timestamp_ms", { precision: 20, scale: 0 }),
    /** Receive timestamp (ms) — when server received the message */
    receiveTimestampMs: numeric("receive_timestamp_ms", { precision: 20, scale: 0 }),
    /** Process timestamp (ms) — when processing completed */
    processTimestampMs: numeric("process_timestamp_ms", { precision: 20, scale: 0 }),
    /** Store timestamp (ms) — when DB write completed */
    storeTimestampMs: numeric("store_timestamp_ms", { precision: 20, scale: 0 }),
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("latency_metrics_provider_idx").on(table.provider),
    index("latency_metrics_type_idx").on(table.metricType),
    index("latency_metrics_symbol_idx").on(table.symbol),
    index("latency_metrics_created_idx").on(table.createdAt),
  ],
);

export const insertLatencyMetricSchema = createInsertSchema(latencyMetricsTable).omit({
  id: true,
  createdAt: true,
});
export const selectLatencyMetricSchema = createSelectSchema(latencyMetricsTable);

export type InsertLatencyMetric = z.infer<typeof insertLatencyMetricSchema>;
export type LatencyMetric = typeof latencyMetricsTable.$inferSelect;
