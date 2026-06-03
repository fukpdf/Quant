import {
  pgTable,
  uuid,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * system_metrics — Node.js process metrics captured every 30 seconds.
 * CPU, memory, heap, event loop lag, and DB/API latency snapshots.
 */
export const systemMetricsTable = pgTable(
  "system_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** CPU usage percentage 0–100 */
    cpuPercent: numeric("cpu_percent", { precision: 6, scale: 2 }),
    /** RSS memory in MB */
    memoryRssMb: numeric("memory_rss_mb", { precision: 10, scale: 2 }),
    /** Heap used in MB */
    heapUsedMb: numeric("heap_used_mb", { precision: 10, scale: 2 }),
    /** Heap total in MB */
    heapTotalMb: numeric("heap_total_mb", { precision: 10, scale: 2 }),
    /** External memory in MB */
    externalMb: numeric("external_mb", { precision: 10, scale: 2 }),
    /** Event loop lag in ms (measured via setImmediate probe) */
    eventLoopLagMs: numeric("event_loop_lag_ms", { precision: 10, scale: 2 }),
    /** DB ping latency in ms */
    dbLatencyMs: numeric("db_latency_ms", { precision: 10, scale: 2 }),
    /** Average API response latency in ms (rolling 60s) */
    apiAvgLatencyMs: numeric("api_avg_latency_ms", { precision: 10, scale: 2 }),
    /** p95 API response latency in ms (rolling 60s) */
    apiP95LatencyMs: numeric("api_p95_latency_ms", { precision: 10, scale: 2 }),
    /** Process uptime in seconds */
    uptimeSeconds: numeric("uptime_seconds", { precision: 12, scale: 0 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("system_metrics_created_idx").on(table.createdAt),
  ],
);

export const insertSystemMetricsSchema = createInsertSchema(systemMetricsTable).omit({
  id: true,
  createdAt: true,
});
export const selectSystemMetricsSchema = createSelectSchema(systemMetricsTable);

export type InsertSystemMetrics = z.infer<typeof insertSystemMetricsSchema>;
export type SystemMetrics = typeof systemMetricsTable.$inferSelect;
