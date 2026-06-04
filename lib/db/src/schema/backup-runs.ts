import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * backup_runs — individual backup execution records.
 * One row per backup attempt with full lifecycle tracking.
 */
export const backupRunsTable = pgTable(
  "backup_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** FK to backup_jobs */
    jobId: uuid("job_id").notNull(),
    /** pending | running | completed | failed | expired */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** full | schema_only | tables */
    backupType: varchar("backup_type", { length: 30 }).notNull().default("full"),
    /** Storage location identifier (path, S3 key, etc.) */
    storageLocation: text("storage_location"),
    /** Backup file size in bytes */
    fileSizeBytes: integer("file_size_bytes"),
    /** Number of tables backed up */
    tableCount: integer("table_count"),
    /** Number of rows backed up */
    rowCount: integer("row_count"),
    /** Duration in milliseconds */
    durationMs: integer("duration_ms"),
    /** pg_dump or equivalent tool version used */
    toolVersion: varchar("tool_version", { length: 50 }),
    /** Checksum of backup file for integrity verification */
    checksum: varchar("checksum", { length: 128 }),
    /** Whether this backup has been validated by a restore test */
    isValidated: boolean("is_validated").notNull().default(false),
    /** Error message if status = failed */
    errorMessage: text("error_message"),
    /** Compression ratio achieved */
    compressionRatio: numeric("compression_ratio", { precision: 5, scale: 2 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("backup_runs_job_idx").on(table.jobId),
    index("backup_runs_status_idx").on(table.status),
    index("backup_runs_created_idx").on(table.createdAt),
    index("backup_runs_expires_idx").on(table.expiresAt),
  ],
);

export const insertBackupRunSchema = createInsertSchema(backupRunsTable).omit({
  id: true,
  createdAt: true,
});
export const selectBackupRunSchema = createSelectSchema(backupRunsTable);

export type InsertBackupRun = z.infer<typeof insertBackupRunSchema>;
export type BackupRun = typeof backupRunsTable.$inferSelect;
