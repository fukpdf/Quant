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
 * event_processing_metrics — aggregated processing performance per event type per window.
 * Written periodically by the metrics processor; used for capacity planning and alerting.
 */
export const eventProcessingMetricsTable = pgTable(
  "event_processing_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    /** Processor component name */
    processor: varchar("processor", { length: 100 }).notNull(),
    /** Measurement window duration (seconds) */
    windowSeconds: numeric("window_seconds", { precision: 5, scale: 0 }).notNull(),
    /** Events processed in this window */
    eventCount: numeric("event_count", { precision: 15, scale: 0 }).notNull().default("0"),
    /** Events dropped/errored in this window */
    errorCount: numeric("error_count", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Min processing time (ms) */
    minMs: numeric("min_ms", { precision: 10, scale: 2 }),
    /** Max processing time (ms) */
    maxMs: numeric("max_ms", { precision: 10, scale: 2 }),
    /** Mean processing time (ms) */
    meanMs: numeric("mean_ms", { precision: 10, scale: 2 }),
    /** p50 processing time (ms) */
    p50Ms: numeric("p50_ms", { precision: 10, scale: 2 }),
    /** p95 processing time (ms) */
    p95Ms: numeric("p95_ms", { precision: 10, scale: 2 }),
    /** p99 processing time (ms) */
    p99Ms: numeric("p99_ms", { precision: 10, scale: 2 }),
    /** Events per second (throughput) */
    throughput: numeric("throughput", { precision: 10, scale: 2 }),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("event_metrics_type_idx").on(table.eventType),
    index("event_metrics_processor_idx").on(table.processor),
    index("event_metrics_window_idx").on(table.windowStart),
  ],
);

export const insertEventProcessingMetricSchema = createInsertSchema(eventProcessingMetricsTable).omit({
  id: true,
  createdAt: true,
});
export const selectEventProcessingMetricSchema = createSelectSchema(eventProcessingMetricsTable);

export type InsertEventProcessingMetric = z.infer<typeof insertEventProcessingMetricSchema>;
export type EventProcessingMetric = typeof eventProcessingMetricsTable.$inferSelect;
