import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * api_metrics — aggregated API request/response metrics per endpoint per window.
 * Captured every 5 minutes covering the preceding window.
 */
export const apiMetricsTable = pgTable(
  "api_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** HTTP method: GET, POST, PATCH, DELETE */
    method: varchar("method", { length: 10 }).notNull(),
    /** Endpoint path pattern e.g. /v1/markets */
    endpoint: varchar("endpoint", { length: 200 }).notNull(),
    /** Total requests in window */
    totalRequests: integer("total_requests").notNull().default(0),
    /** Requests returning 2xx */
    successCount: integer("success_count").notNull().default(0),
    /** Requests returning 4xx */
    clientErrorCount: integer("client_error_count").notNull().default(0),
    /** Requests returning 5xx */
    serverErrorCount: integer("server_error_count").notNull().default(0),
    /** Average response latency in ms */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    /** p50 response latency in ms */
    p50LatencyMs: numeric("p50_latency_ms", { precision: 10, scale: 2 }),
    /** p95 response latency in ms */
    p95LatencyMs: numeric("p95_latency_ms", { precision: 10, scale: 2 }),
    /** p99 response latency in ms */
    p99LatencyMs: numeric("p99_latency_ms", { precision: 10, scale: 2 }),
    /** Error rate 0.0–1.0 */
    errorRate: numeric("error_rate", { precision: 5, scale: 4 }),
    /** Window start timestamp */
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    /** Window end timestamp */
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("api_metrics_endpoint_idx").on(table.endpoint),
    index("api_metrics_window_idx").on(table.windowStart),
    index("api_metrics_method_endpoint_idx").on(table.method, table.endpoint),
  ],
);

export const insertApiMetricsSchema = createInsertSchema(apiMetricsTable).omit({
  id: true,
  createdAt: true,
});
export const selectApiMetricsSchema = createSelectSchema(apiMetricsTable);

export type InsertApiMetrics = z.infer<typeof insertApiMetricsSchema>;
export type ApiMetrics = typeof apiMetricsTable.$inferSelect;
