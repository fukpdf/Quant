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
 * restore_tests — restore validation records.
 * Periodically verifies backup recoverability by performing a test restore.
 */
export const restoreTestsTable = pgTable(
  "restore_tests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** FK to backup_runs being tested */
    backupRunId: uuid("backup_run_id").notNull(),
    /** pending | running | passed | failed */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** checksum | row_count | schema | full */
    testType: varchar("test_type", { length: 30 }).notNull().default("checksum"),
    /** Whether all assertions passed */
    passed: boolean("passed"),
    /** Number of tables verified */
    tablesVerified: integer("tables_verified"),
    /** Number of rows verified */
    rowsVerified: integer("rows_verified"),
    /** Duration of the test in milliseconds */
    durationMs: integer("duration_ms"),
    /** Summary of test results */
    resultSummary: text("result_summary"),
    /** Detailed error if failed */
    errorDetail: text("error_detail"),
    /** Initiated by: system | operator */
    initiatedBy: varchar("initiated_by", { length: 50 }).notNull().default("system"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("restore_tests_backup_run_idx").on(table.backupRunId),
    index("restore_tests_status_idx").on(table.status),
    index("restore_tests_created_idx").on(table.createdAt),
  ],
);

export const insertRestoreTestSchema = createInsertSchema(restoreTestsTable).omit({
  id: true,
  createdAt: true,
});
export const selectRestoreTestSchema = createSelectSchema(restoreTestsTable);

export type InsertRestoreTest = z.infer<typeof insertRestoreTestSchema>;
export type RestoreTest = typeof restoreTestsTable.$inferSelect;
