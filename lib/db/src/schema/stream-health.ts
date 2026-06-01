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
 * stream_health — per-provider health snapshots captured periodically.
 * One row per health check event. Latest row per provider = current health.
 */
export const streamHealthTable = pgTable(
  "stream_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull(),
    /** healthy | degraded | disconnected | failed */
    connectionStatus: varchar("connection_status", { length: 30 }).notNull(),
    /** Seconds since last heartbeat */
    heartbeatAgeSeconds: numeric("heartbeat_age_seconds", { precision: 10, scale: 1 }),
    /** Seconds since last tick received */
    lastTickAgeSeconds: numeric("last_tick_age_seconds", { precision: 10, scale: 1 }),
    /** Total reconnect attempts since startup */
    reconnectCount: numeric("reconnect_count", { precision: 8, scale: 0 }).notNull().default("0"),
    /** Total failure count since startup */
    failureCount: numeric("failure_count", { precision: 8, scale: 0 }).notNull().default("0"),
    /** Ticks per second (rolling 60s average) */
    ticksPerSecond: numeric("ticks_per_second", { precision: 10, scale: 2 }),
    /** Average processing latency ms (rolling 60s) */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    /** p99 processing latency ms (rolling 60s) */
    p99LatencyMs: numeric("p99_latency_ms", { precision: 10, scale: 2 }),
    /** Composite health score 0–100 */
    healthScore: numeric("health_score", { precision: 5, scale: 1 }),
    /** Subscribed symbol count */
    subscribedSymbols: numeric("subscribed_symbols", { precision: 5, scale: 0 }).default("0"),
    /** Active session ID */
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stream_health_provider_idx").on(table.provider),
    index("stream_health_provider_created_idx").on(table.provider, table.createdAt),
  ],
);

export const insertStreamHealthSchema = createInsertSchema(streamHealthTable).omit({
  id: true,
  createdAt: true,
});
export const selectStreamHealthSchema = createSelectSchema(streamHealthTable);

export type InsertStreamHealth = z.infer<typeof insertStreamHealthSchema>;
export type StreamHealth = typeof streamHealthTable.$inferSelect;
