import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Structured ingestion job records.
 * One row per ingestion run (per symbol+interval).
 * Supersedes ingestion_logs (kept for backward compat) with richer tracking:
 * explicit start/end times, job type classification, and structured error details.
 */
export const ingestionJobsTable = pgTable(
  "ingestion_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** candle_backfill | candle_incremental | quality_check | provider_health */
    jobType: varchar("job_type", { length: 50 }).notNull(),
    providerName: varchar("provider_name", { length: 50 }).notNull(),
    symbol: varchar("symbol", { length: 30 }),
    interval: varchar("interval", { length: 10 }),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    recordsProcessed: integer("records_processed").notNull().default(0),
    recordsInserted: integer("records_inserted").notNull().default(0),
    /** JSON blob with structured error details */
    errorDetails: text("error_details"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ingestion_jobs_provider_idx").on(table.providerName),
    index("ingestion_jobs_status_idx").on(table.status),
    index("ingestion_jobs_started_at_idx").on(table.startedAt),
    index("ingestion_jobs_symbol_interval_idx").on(table.symbol, table.interval),
  ],
);

export const insertIngestionJobSchema = createInsertSchema(
  ingestionJobsTable,
).omit({ id: true, createdAt: true });

export const selectIngestionJobSchema = createSelectSchema(ingestionJobsTable);

export type InsertIngestionJob = z.infer<typeof insertIngestionJobSchema>;
export type IngestionJob = typeof ingestionJobsTable.$inferSelect;
