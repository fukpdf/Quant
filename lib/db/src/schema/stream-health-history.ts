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
 * stream_health_history — monitoring-level stream health snapshots.
 * Captured by the ops monitoring layer (distinct from Phase 9 stream_health).
 * Used for trend analysis, alerting, and the ops dashboard.
 */
export const streamHealthHistoryTable = pgTable(
  "stream_health_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Stream provider name: mock | binance | forex | equities */
    provider: varchar("provider", { length: 50 }).notNull(),
    /** connected | degraded | disconnected | failed */
    connectionStatus: varchar("connection_status", { length: 30 }).notNull(),
    /** Composite health score 0–100 */
    healthScore: numeric("health_score", { precision: 5, scale: 1 }),
    /** Average tick latency ms */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    /** p99 tick latency ms */
    p99LatencyMs: numeric("p99_latency_ms", { precision: 10, scale: 2 }),
    /** Ticks per second (rolling 60s) */
    ticksPerSecond: numeric("ticks_per_second", { precision: 10, scale: 2 }),
    /** Total reconnect attempts since startup */
    reconnectCount: numeric("reconnect_count", { precision: 8, scale: 0 }).notNull().default("0"),
    /** Total failure count since startup */
    failureCount: numeric("failure_count", { precision: 8, scale: 0 }).notNull().default("0"),
    /** Number of subscribed symbols */
    subscribedSymbols: numeric("subscribed_symbols", { precision: 5, scale: 0 }).default("0"),
    /** Seconds since last tick received */
    lastTickAgeSeconds: numeric("last_tick_age_seconds", { precision: 10, scale: 1 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stream_health_history_provider_idx").on(table.provider),
    index("stream_health_history_created_idx").on(table.createdAt),
    index("stream_health_history_provider_created_idx").on(table.provider, table.createdAt),
  ],
);

export const insertStreamHealthHistorySchema = createInsertSchema(streamHealthHistoryTable).omit({
  id: true,
  createdAt: true,
});
export const selectStreamHealthHistorySchema = createSelectSchema(streamHealthHistoryTable);

export type InsertStreamHealthHistory = z.infer<typeof insertStreamHealthHistorySchema>;
export type StreamHealthHistory = typeof streamHealthHistoryTable.$inferSelect;
