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
 * monitoring_audit_log — immutable audit trail for all monitoring operations.
 * Records alert acknowledgements, incident resolutions, rule changes, and manual ops actions.
 * Never updated or deleted.
 */
export const monitoringAuditLogTable = pgTable(
  "monitoring_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Who performed the action: system | operator */
    actor: varchar("actor", { length: 100 }).notNull().default("system"),
    /** Action type: alert_fired | alert_acknowledged | alert_resolved | incident_opened | incident_resolved | rule_enabled | rule_disabled | metric_collected */
    action: varchar("action", { length: 80 }).notNull(),
    /** Target entity type: alert | incident | rule | metric | scheduler | service */
    targetType: varchar("target_type", { length: 50 }),
    /** Target entity ID */
    targetId: varchar("target_id", { length: 100 }),
    /** Human-readable description */
    description: varchar("description", { length: 500 }),
    /** Structured payload */
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("monitoring_audit_action_idx").on(table.action),
    index("monitoring_audit_actor_idx").on(table.actor),
    index("monitoring_audit_created_idx").on(table.createdAt),
    index("monitoring_audit_target_idx").on(table.targetType, table.targetId),
  ],
);

export const insertMonitoringAuditLogSchema = createInsertSchema(monitoringAuditLogTable).omit({
  id: true,
  createdAt: true,
});
export const selectMonitoringAuditLogSchema = createSelectSchema(monitoringAuditLogTable);

export type InsertMonitoringAuditLog = z.infer<typeof insertMonitoringAuditLogSchema>;
export type MonitoringAuditLog = typeof monitoringAuditLogTable.$inferSelect;
