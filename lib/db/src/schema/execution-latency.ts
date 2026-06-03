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
import { executionOrdersTable } from "./execution-orders";

/**
 * Execution latency — per-stage latency measurements for every order.
 *
 * Records the time spent at each stage of the execution pipeline:
 * validation → risk → routing → provider (ACK) → fill → end_to_end
 *
 * Used to track execution quality and identify bottlenecks.
 */
export const executionLatencyTable = pgTable(
  "execution_latency",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => executionOrdersTable.id),
    /** validation | risk | routing | provider | fill | end_to_end */
    stage: varchar("stage", { length: 30 }).notNull(),
    /** Latency in milliseconds for this stage */
    latencyMs: numeric("latency_ms", { precision: 10, scale: 3 }).notNull(),
    /** Provider involved (for routing/provider/fill stages) */
    provider: varchar("provider", { length: 30 }),
    /** Execution mode context */
    executionMode: varchar("execution_mode", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_latency_order_id_idx").on(table.orderId),
    index("exec_latency_stage_idx").on(table.stage),
    index("exec_latency_provider_idx").on(table.provider),
    index("exec_latency_created_at_idx").on(table.createdAt),
  ],
);

export const insertExecutionLatencySchema = createInsertSchema(executionLatencyTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionLatencySchema = createSelectSchema(executionLatencyTable);

export type InsertExecutionLatency = z.infer<typeof insertExecutionLatencySchema>;
export type ExecutionLatency = typeof executionLatencyTable.$inferSelect;
