import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * backup_audit_log — immutable audit trail for all backup and recovery operations.
 * Never updated or deleted.
 */
export const backupAuditLogTable = pgTable(
  "backup_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Who initiated: system | operator */
    actor: varchar("actor", { length: 100 }).notNull().default("system"),
    /** Action type: backup_started | backup_completed | backup_failed | restore_test_started | restore_test_passed | restore_test_failed | backup_expired | job_created | job_disabled */
    action: varchar("action", { length: 80 }).notNull(),
    /** Target entity type: backup_job | backup_run | restore_test */
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
    index("backup_audit_action_idx").on(table.action),
    index("backup_audit_actor_idx").on(table.actor),
    index("backup_audit_created_idx").on(table.createdAt),
    index("backup_audit_target_idx").on(table.targetType, table.targetId),
  ],
);

export const insertBackupAuditLogSchema = createInsertSchema(backupAuditLogTable).omit({
  id: true,
  createdAt: true,
});
export const selectBackupAuditLogSchema = createSelectSchema(backupAuditLogTable);

export type InsertBackupAuditLog = z.infer<typeof insertBackupAuditLogSchema>;
export type BackupAuditLog = typeof backupAuditLogTable.$inferSelect;
