import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * stream_recovery_events — records every recovery action taken after a stream failure.
 * Used for post-incident analysis and tuning reconnection strategy.
 */
export const streamRecoveryEventsTable = pgTable(
  "stream_recovery_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Original failure that triggered recovery */
    failureId: uuid("failure_id"),
    sessionId: uuid("session_id"),
    /** reconnect | backfill | gap_fill | session_repair | manual */
    recoveryType: varchar("recovery_type", { length: 50 }).notNull(),
    /** started | in_progress | completed | failed */
    status: varchar("status", { length: 30 }).notNull().default("started"),
    /** Symbol being recovered (null = all symbols) */
    symbol: varchar("symbol", { length: 20 }),
    /** Estimated ticks missed during the gap */
    estimatedGapTicks: numeric("estimated_gap_ticks", { precision: 10, scale: 0 }),
    /** Ticks successfully recovered */
    recoveredTicks: numeric("recovered_ticks", { precision: 10, scale: 0 }),
    /** Backfill start time if applicable */
    backfillFrom: timestamp("backfill_from", { withTimezone: true }),
    /** Backfill end time if applicable */
    backfillTo: timestamp("backfill_to", { withTimezone: true }),
    /** Time taken to complete recovery (ms) */
    durationMs: numeric("duration_ms", { precision: 10, scale: 0 }),
    /** Was recovery fully successful */
    success: boolean("success"),
    /** Error if recovery failed */
    errorMessage: varchar("error_message", { length: 500 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stream_recovery_provider_idx").on(table.provider),
    index("stream_recovery_session_idx").on(table.sessionId),
    index("stream_recovery_status_idx").on(table.status),
    index("stream_recovery_created_idx").on(table.createdAt),
  ],
);

export const insertStreamRecoveryEventSchema = createInsertSchema(streamRecoveryEventsTable).omit({
  id: true,
  createdAt: true,
});
export const selectStreamRecoveryEventSchema = createSelectSchema(streamRecoveryEventsTable);

export type InsertStreamRecoveryEvent = z.infer<typeof insertStreamRecoveryEventSchema>;
export type StreamRecoveryEvent = typeof streamRecoveryEventsTable.$inferSelect;
