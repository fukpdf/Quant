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
 * scheduler_health — per-scheduler execution tracking.
 * One row per scheduler run. Latest row per scheduler_name = current state.
 */
export const schedulerHealthTable = pgTable(
  "scheduler_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Scheduler identifier e.g. ingestion, paper_signal, risk_snapshot, analytics, stream, execution, intelligence_regime */
    schedulerName: varchar("scheduler_name", { length: 100 }).notNull(),
    /** Phase this scheduler belongs to */
    phase: varchar("phase", { length: 30 }),
    /** ok | missed | failed | running */
    status: varchar("status", { length: 30 }).notNull(),
    /** Timestamp of last successful execution */
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    /** Timestamp of next scheduled execution */
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    /** Configured interval in milliseconds */
    intervalMs: numeric("interval_ms", { precision: 12, scale: 0 }),
    /** Duration of last run in milliseconds */
    lastRuntimeMs: numeric("last_runtime_ms", { precision: 10, scale: 2 }),
    /** Total missed execution count since startup */
    missedCount: numeric("missed_count", { precision: 8, scale: 0 }).notNull().default("0"),
    /** Total failure count since startup */
    failureCount: numeric("failure_count", { precision: 8, scale: 0 }).notNull().default("0"),
    /** Total successful run count since startup */
    successCount: numeric("success_count", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Whether this scheduler is currently active */
    isActive: boolean("is_active").notNull().default(true),
    /** Last error message if status=failed */
    lastError: varchar("last_error", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("scheduler_health_name_idx").on(table.schedulerName),
    index("scheduler_health_name_created_idx").on(table.schedulerName, table.createdAt),
    index("scheduler_health_status_idx").on(table.status),
  ],
);

export const insertSchedulerHealthSchema = createInsertSchema(schedulerHealthTable).omit({
  id: true,
  createdAt: true,
});
export const selectSchedulerHealthSchema = createSelectSchema(schedulerHealthTable);

export type InsertSchedulerHealth = z.infer<typeof insertSchedulerHealthSchema>;
export type SchedulerHealth = typeof schedulerHealthTable.$inferSelect;
