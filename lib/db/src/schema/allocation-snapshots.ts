import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * allocation_snapshots — periodic snapshots of how capital is allocated
 * across strategies and assets. Used for allocation drift analysis.
 */
export const allocationSnapshotsTable = pgTable(
  "allocation_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
    /** Total portfolio equity at snapshot time */
    totalEquity: numeric("total_equity", { precision: 18, scale: 8 }),
    /** Cash as % of equity */
    cashAllocationPct: numeric("cash_allocation_pct", { precision: 10, scale: 4 }),
    /** Invested (deployed) capital as % of equity */
    investedAllocationPct: numeric("invested_allocation_pct", { precision: 10, scale: 4 }),
    /** Number of active positions */
    activePositionCount: integer("active_position_count").default(0),
    /** Number of active strategies */
    activeStrategyCount: integer("active_strategy_count").default(0),
    /** Per-strategy allocation breakdown: JSON array of { strategy, pct, value } */
    strategyBreakdown: jsonb("strategy_breakdown"),
    /** Per-asset allocation breakdown: JSON array of { symbol, pct, value } */
    assetBreakdown: jsonb("asset_breakdown"),
    /** Herfindahl-Hirschman Index for concentration (0–10000, lower = more diverse) */
    hhi: numeric("hhi", { precision: 10, scale: 4 }),
    /** Effective number of independent bets (1/HHI) */
    effectiveN: numeric("effective_n", { precision: 8, scale: 4 }),
    /** Largest single position as % of equity */
    largestPositionPct: numeric("largest_position_pct", { precision: 10, scale: 4 }),
    /** Symbol of largest position */
    largestPositionSymbol: varchar("largest_position_symbol", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("allocation_snapshots_account_idx").on(table.accountId),
    index("allocation_snapshots_snapshot_at_idx").on(table.snapshotAt),
  ],
);

export const insertAllocationSnapshotSchema = createInsertSchema(allocationSnapshotsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAllocationSnapshotSchema = createSelectSchema(allocationSnapshotsTable);

export type InsertAllocationSnapshot = z.infer<typeof insertAllocationSnapshotSchema>;
export type AllocationSnapshot = typeof allocationSnapshotsTable.$inferSelect;
