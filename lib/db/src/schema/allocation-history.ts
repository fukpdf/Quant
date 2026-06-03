import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { portfolioAllocationsTable } from "./portfolio-allocations";

/**
 * allocation_history — immutable audit trail of portfolio weight transitions.
 *
 * Every time the active allocation changes (rebalance, regime shift,
 * re-optimization, or manual override), a record is written here.
 *
 * reason: rebalance | regime_change | optimization | manual | initial
 */
export const allocationHistoryTable = pgTable(
  "allocation_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The new allocation that became active */
    allocationId: uuid("allocation_id")
      .notNull()
      .references(() => portfolioAllocationsTable.id),
    /** Previous weights before this transition { strategyName: weight } */
    previousWeights: jsonb("previous_weights").notNull().default({}),
    /** New weights after this transition { strategyName: weight } */
    newWeights: jsonb("new_weights").notNull().default({}),
    /** Weight deltas: how much each strategy's weight changed */
    weightDeltas: jsonb("weight_deltas").notNull().default({}),
    /** rebalance | regime_change | optimization | manual | initial */
    reason: varchar("reason", { length: 30 }).notNull(),
    /** What triggered this change: scheduler | api | regime_engine | optimizer */
    triggeredBy: varchar("triggered_by", { length: 50 }).notNull().default("system"),
    /** Optional human or system note explaining the change */
    notes: text("notes"),
    /** Regime ID that triggered this change (if regime_change) */
    regimeId: uuid("regime_id"),
    /** Optimization run ID that triggered this change (if optimization) */
    optimizationRunId: uuid("optimization_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alloc_history_allocation_id_idx").on(table.allocationId),
    index("alloc_history_reason_idx").on(table.reason),
    index("alloc_history_created_at_idx").on(table.createdAt),
    index("alloc_history_triggered_by_idx").on(table.triggeredBy),
  ],
);

export const insertAllocationHistorySchema = createInsertSchema(allocationHistoryTable).omit({
  id: true,
  createdAt: true,
});

export const selectAllocationHistorySchema = createSelectSchema(allocationHistoryTable);

export type InsertAllocationHistory = z.infer<typeof insertAllocationHistorySchema>;
export type AllocationHistory = typeof allocationHistoryTable.$inferSelect;
