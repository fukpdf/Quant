import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * execution_health — execution engine health snapshot per time window.
 * Aggregates order, fill, rejection, and latency metrics.
 */
export const executionHealthTable = pgTable(
  "execution_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Window identifier: 1h | 4h | 1d */
    window: varchar("window", { length: 10 }).notNull(),
    /** healthy | degraded | failed */
    status: varchar("status", { length: 30 }).notNull().default("healthy"),
    /** Composite health score 0–100 */
    healthScore: numeric("health_score", { precision: 5, scale: 1 }),
    /** Total orders in window */
    totalOrders: integer("total_orders").notNull().default(0),
    /** Filled orders */
    filledOrders: integer("filled_orders").notNull().default(0),
    /** Rejected orders */
    rejectedOrders: integer("rejected_orders").notNull().default(0),
    /** Cancelled orders */
    cancelledOrders: integer("cancelled_orders").notNull().default(0),
    /** Fill rate 0.0–1.0 */
    fillRate: numeric("fill_rate", { precision: 5, scale: 4 }),
    /** Rejection rate 0.0–1.0 */
    rejectionRate: numeric("rejection_rate", { precision: 5, scale: 4 }),
    /** Average order-to-fill latency ms */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    /** p95 order-to-fill latency ms */
    p95LatencyMs: numeric("p95_latency_ms", { precision: 10, scale: 2 }),
    /** Average slippage in basis points */
    avgSlippageBps: numeric("avg_slippage_bps", { precision: 8, scale: 4 }),
    /** Error rate (failed + rejected) / total */
    errorRate: numeric("error_rate", { precision: 5, scale: 4 }),
    /** Active execution mode: simulation | paper | live_disabled */
    executionMode: varchar("execution_mode", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("execution_health_window_idx").on(table.window),
    index("execution_health_created_idx").on(table.createdAt),
  ],
);

export const insertExecutionHealthSchema = createInsertSchema(executionHealthTable).omit({
  id: true,
  createdAt: true,
});
export const selectExecutionHealthSchema = createSelectSchema(executionHealthTable);

export type InsertExecutionHealth = z.infer<typeof insertExecutionHealthSchema>;
export type ExecutionHealth = typeof executionHealthTable.$inferSelect;
