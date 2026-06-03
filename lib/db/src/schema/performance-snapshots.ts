import {
  pgTable,
  uuid,
  numeric,
  integer,
  jsonb,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * performance_snapshots — overall platform health score snapshots.
 * Captured every 15 minutes. Score 0–100 with per-layer component scores.
 */
export const performanceSnapshotsTable = pgTable(
  "performance_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Overall composite platform score 0–100 */
    overallScore: integer("overall_score").notNull(),
    /** Per-layer scores as { dataLayer, researchLayer, riskLayer, aiLayer, streamingLayer, executionLayer, intelligenceLayer } */
    componentScores: jsonb("component_scores").notNull(),
    /** Active alert count at snapshot time */
    activeAlerts: integer("active_alerts").notNull().default(0),
    /** Open incident count at snapshot time */
    openIncidents: integer("open_incidents").notNull().default(0),
    /** Services with status != running */
    degradedServices: integer("degraded_services").notNull().default(0),
    /** Schedulers with missed executions */
    missedSchedulers: integer("missed_schedulers").notNull().default(0),
    /** Observations as array of strings */
    observations: jsonb("observations").notNull().default([]),
    /** System memory RSS in MB at snapshot time */
    memoryRssMb: numeric("memory_rss_mb", { precision: 10, scale: 2 }),
    /** CPU percent at snapshot time */
    cpuPercent: numeric("cpu_percent", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("performance_snapshots_created_idx").on(table.createdAt),
    index("performance_snapshots_score_idx").on(table.overallScore),
  ],
);

export const insertPerformanceSnapshotsSchema = createInsertSchema(performanceSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export const selectPerformanceSnapshotsSchema = createSelectSchema(performanceSnapshotsTable);

export type InsertPerformanceSnapshot = z.infer<typeof insertPerformanceSnapshotsSchema>;
export type PerformanceSnapshot = typeof performanceSnapshotsTable.$inferSelect;
