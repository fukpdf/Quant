import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * backup_jobs — registered backup job configurations.
 * Each job defines schedule, retention policy, and target scope.
 */
export const backupJobsTable = pgTable(
  "backup_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable job name */
    name: varchar("name", { length: 100 }).notNull(),
    /** full | schema_only | tables */
    backupType: varchar("backup_type", { length: 30 }).notNull().default("full"),
    /** Comma-separated table names for partial backups (null = all) */
    targetTables: text("target_tables"),
    /** Cron-style schedule description (e.g. "every 6 hours") */
    scheduleDescription: varchar("schedule_description", { length: 100 }),
    /** Interval in milliseconds between runs */
    intervalMs: integer("interval_ms").notNull().default(21600000),
    /** Number of backup runs to retain */
    retentionCount: integer("retention_count").notNull().default(7),
    /** Whether the job is currently active */
    isActive: boolean("is_active").notNull().default(true),
    /** Timestamp of last successful run */
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    /** Timestamp of next scheduled run */
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("backup_jobs_active_idx").on(table.isActive),
    index("backup_jobs_next_run_idx").on(table.nextRunAt),
  ],
);

export const insertBackupJobSchema = createInsertSchema(backupJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectBackupJobSchema = createSelectSchema(backupJobsTable);

export type InsertBackupJob = z.infer<typeof insertBackupJobSchema>;
export type BackupJob = typeof backupJobsTable.$inferSelect;
