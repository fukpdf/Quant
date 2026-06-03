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
 * Execution metrics — aggregated analytics snapshots.
 *
 * Computed periodically by the analytics engine.
 * Tracks quality metrics per account/mode/period:
 * - Fill rate, reject rate, cancel rate
 * - Slippage, latency percentiles
 * - Provider performance
 */
export const executionMetricsTable = pgTable(
  "execution_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id"),
    /** simulation | paper | live_disabled | all */
    executionMode: varchar("execution_mode", { length: 20 }).notNull(),
    /** Provider this metrics snapshot covers */
    provider: varchar("provider", { length: 30 }),
    /** Period: 1h | 4h | 1d | 7d | 30d */
    period: varchar("period", { length: 10 }).notNull(),
    /** Total orders placed in this period */
    totalOrders: numeric("total_orders", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total orders filled */
    totalFills: numeric("total_fills", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total orders rejected */
    totalRejections: numeric("total_rejections", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total orders cancelled */
    totalCancellations: numeric("total_cancellations", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Fill rate as decimal (0.0–1.0) */
    fillRate: numeric("fill_rate", { precision: 6, scale: 4 }),
    /** Reject rate as decimal */
    rejectRate: numeric("reject_rate", { precision: 6, scale: 4 }),
    /** Cancel rate as decimal */
    cancelRate: numeric("cancel_rate", { precision: 6, scale: 4 }),
    /** Average slippage in basis points */
    avgSlippageBps: numeric("avg_slippage_bps", { precision: 10, scale: 4 }),
    /** Average time to fill in ms */
    avgFillTimeMs: numeric("avg_fill_time_ms", { precision: 10, scale: 2 }),
    /** Average end-to-end latency */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    p50LatencyMs: numeric("p50_latency_ms", { precision: 10, scale: 2 }),
    p95LatencyMs: numeric("p95_latency_ms", { precision: 10, scale: 2 }),
    p99LatencyMs: numeric("p99_latency_ms", { precision: 10, scale: 2 }),
    /** Overall execution success rate */
    successRate: numeric("success_rate", { precision: 6, scale: 4 }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_metrics_account_id_idx").on(table.accountId),
    index("exec_metrics_mode_idx").on(table.executionMode),
    index("exec_metrics_period_idx").on(table.period),
    index("exec_metrics_computed_at_idx").on(table.computedAt),
  ],
);

export const insertExecutionMetricSchema = createInsertSchema(executionMetricsTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionMetricSchema = createSelectSchema(executionMetricsTable);

export type InsertExecutionMetric = z.infer<typeof insertExecutionMetricSchema>;
export type ExecutionMetric = typeof executionMetricsTable.$inferSelect;
