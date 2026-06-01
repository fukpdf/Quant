import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * stream_audit_log — immutable record of all significant streaming infrastructure events.
 * Never deleted. Used for incident investigation, compliance, and capacity analysis.
 */
export const streamAuditLogTable = pgTable(
  "stream_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Action performed: stream_start | stream_stop | reconnect | provider_switch | backfill | replay_start | replay_stop | gap_detected | recovery_complete */
    action: varchar("action", { length: 80 }).notNull(),
    provider: varchar("provider", { length: 50 }),
    sessionId: uuid("session_id"),
    /** Symbol affected (null = all) */
    symbol: varchar("symbol", { length: 20 }),
    /** Actor: "system" | "scheduler" | "api" */
    actor: varchar("actor", { length: 50 }).notNull().default("system"),
    /** Action-specific context */
    detail: jsonb("detail"),
    /** Was this action successful */
    success: boolean("success").notNull().default(true),
    /** Error if action failed */
    errorMessage: varchar("error_message", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("stream_audit_action_idx").on(table.action),
    index("stream_audit_provider_idx").on(table.provider),
    index("stream_audit_created_idx").on(table.createdAt),
    index("stream_audit_session_idx").on(table.sessionId),
  ],
);

export const insertStreamAuditLogSchema = createInsertSchema(streamAuditLogTable).omit({
  id: true,
  createdAt: true,
});
export const selectStreamAuditLogSchema = createSelectSchema(streamAuditLogTable);

export type InsertStreamAuditLog = z.infer<typeof insertStreamAuditLogSchema>;
export type StreamAuditLog = typeof streamAuditLogTable.$inferSelect;
