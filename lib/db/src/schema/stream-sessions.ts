import {
  pgTable,
  uuid,
  varchar,
  numeric,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * stream_sessions — lifecycle record for each WebSocket streaming session.
 * One row per connection attempt. Tracks connection, subscription, and termination.
 */
export const streamSessionsTable = pgTable(
  "stream_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Provider identifier e.g. "binance", "mock" */
    provider: varchar("provider", { length: 50 }).notNull(),
    /** connecting | active | reconnecting | closed | failed */
    status: varchar("status", { length: 30 }).notNull().default("connecting"),
    /** Symbols subscribed in this session */
    symbols: jsonb("symbols").$type<string[]>().default([]),
    /** Stream types: ["ticker", "orderbook", "trade"] */
    streamTypes: jsonb("stream_types").$type<string[]>().default([]),
    /** WebSocket endpoint URL (no credentials) */
    endpoint: varchar("endpoint", { length: 500 }),
    /** Reconnect attempt number (0 = initial connection) */
    reconnectCount: numeric("reconnect_count", { precision: 5, scale: 0 }).notNull().default("0"),
    /** Total ticks received in this session */
    ticksReceived: numeric("ticks_received", { precision: 15, scale: 0 }).notNull().default("0"),
    /** Total events processed */
    eventsProcessed: numeric("events_processed", { precision: 15, scale: 0 }).notNull().default("0"),
    /** Total bytes received */
    bytesReceived: numeric("bytes_received", { precision: 20, scale: 0 }).notNull().default("0"),
    /** Average message latency ms in this session */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    /** Graceful shutdown flag */
    isGraceful: boolean("is_graceful").default(false),
    /** Error message on failure */
    errorMessage: varchar("error_message", { length: 1000 }),
    /** Session start */
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    /** Session end (null = still active) */
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stream_sessions_provider_idx").on(table.provider),
    index("stream_sessions_status_idx").on(table.status),
    index("stream_sessions_started_at_idx").on(table.startedAt),
  ],
);

export const insertStreamSessionSchema = createInsertSchema(streamSessionsTable).omit({
  id: true,
  createdAt: true,
});
export const selectStreamSessionSchema = createSelectSchema(streamSessionsTable);

export type InsertStreamSession = z.infer<typeof insertStreamSessionSchema>;
export type StreamSession = typeof streamSessionsTable.$inferSelect;
