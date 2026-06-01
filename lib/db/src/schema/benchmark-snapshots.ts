import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * benchmark_snapshots — historical price / index level snapshots for benchmarks.
 * Used to compute benchmark returns for comparison periods.
 * One row per benchmark per snapshot interval.
 */
export const benchmarkSnapshotsTable = pgTable(
  "benchmark_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    benchmarkId: uuid("benchmark_id").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull(),
    /** Price or index level at this snapshot */
    price: numeric("price", { precision: 18, scale: 8 }).notNull(),
    /** Return since previous snapshot (%) */
    periodReturnPct: numeric("period_return_pct", { precision: 12, scale: 6 }),
    /** Cumulative return since inception of tracking (%) */
    cumulativeReturnPct: numeric("cumulative_return_pct", { precision: 12, scale: 6 }),
    /** For basket benchmarks: weighted composite price */
    isComposite: varchar("is_composite", { length: 5 }).default("false"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("benchmark_snapshots_benchmark_id_idx").on(table.benchmarkId),
    index("benchmark_snapshots_snapshot_at_idx").on(table.snapshotAt),
  ],
);

export const insertBenchmarkSnapshotSchema = createInsertSchema(benchmarkSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export const selectBenchmarkSnapshotSchema = createSelectSchema(benchmarkSnapshotsTable);

export type InsertBenchmarkSnapshot = z.infer<typeof insertBenchmarkSnapshotSchema>;
export type BenchmarkSnapshot = typeof benchmarkSnapshotsTable.$inferSelect;
