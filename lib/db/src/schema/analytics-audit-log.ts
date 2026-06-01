import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * analytics_audit_log — immutable audit trail for all analytics system actions.
 * Tracks when metrics are computed, benchmarks updated, health scores refreshed, etc.
 * Never updated or deleted — append-only.
 */
export const analyticsAuditLogTable = pgTable(
  "analytics_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Who or what triggered this action (api | scheduler | system) */
    actor: varchar("actor", { length: 50 }).notNull().default("system"),
    /** Action type (e.g. performance.compute, health.score, attribution.run) */
    action: varchar("action", { length: 100 }).notNull(),
    /** Account ID if action is account-scoped */
    accountId: uuid("account_id"),
    /** Entity type (analytics | performance | health | attribution | benchmark | recommendation) */
    entityType: varchar("entity_type", { length: 50 }),
    /** Entity ID */
    entityId: uuid("entity_id"),
    /** success | failure | skipped */
    result: varchar("result", { length: 20 }).notNull().default("success"),
    /** Duration in ms */
    durationMs: varchar("duration_ms", { length: 20 }),
    /** Action payload / context */
    payload: jsonb("payload"),
    /** Error message if result = failure */
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("analytics_audit_log_action_idx").on(table.action),
    index("analytics_audit_log_account_idx").on(table.accountId),
    index("analytics_audit_log_created_at_idx").on(table.createdAt),
  ],
);

export const insertAnalyticsAuditLogSchema = createInsertSchema(analyticsAuditLogTable).omit({
  id: true,
  createdAt: true,
});
export const selectAnalyticsAuditLogSchema = createSelectSchema(analyticsAuditLogTable);

export type InsertAnalyticsAuditLog = z.infer<typeof insertAnalyticsAuditLogSchema>;
export type AnalyticsAuditLog = typeof analyticsAuditLogTable.$inferSelect;
