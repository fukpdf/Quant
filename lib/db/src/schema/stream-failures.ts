import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * stream_failures — immutable record of every streaming failure event.
 * Includes connection errors, heartbeat timeouts, parse errors, and backpressure events.
 */
export const streamFailuresTable = pgTable(
  "stream_failures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull(),
    sessionId: uuid("session_id"),
    /** connection_error | heartbeat_timeout | parse_error | rate_limit | provider_outage | backpressure */
    failureType: varchar("failure_type", { length: 50 }).notNull(),
    /** Human-readable error description */
    message: varchar("message", { length: 1000 }).notNull(),
    /** Raw error details (stack trace, provider error code, etc.) */
    errorDetail: jsonb("error_detail"),
    /** Affected symbols at time of failure */
    affectedSymbols: jsonb("affected_symbols").$type<string[]>().default([]),
    /** Recovery action taken: reconnect | backfill | skip | none */
    recoveryAction: varchar("recovery_action", { length: 50 }),
    /** Was recovery successful */
    recovered: varchar("recovered", { length: 10 }).default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stream_failures_provider_idx").on(table.provider),
    index("stream_failures_session_idx").on(table.sessionId),
    index("stream_failures_type_idx").on(table.failureType),
    index("stream_failures_created_idx").on(table.createdAt),
  ],
);

export const insertStreamFailureSchema = createInsertSchema(streamFailuresTable).omit({
  id: true,
  createdAt: true,
});
export const selectStreamFailureSchema = createSelectSchema(streamFailuresTable);

export type InsertStreamFailure = z.infer<typeof insertStreamFailureSchema>;
export type StreamFailure = typeof streamFailuresTable.$inferSelect;
