import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionOrdersTable } from "./execution-orders";

/**
 * Execution rejections — detailed rejection log per order.
 *
 * Captures the exact stage and reason for every order that didn't proceed.
 * Immutable — no updates after creation.
 *
 * stage: validation | risk | routing | provider
 */
export const executionRejectionsTable = pgTable(
  "execution_rejections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => executionOrdersTable.id),
    /** validation | risk | routing | provider */
    stage: varchar("stage", { length: 20 }).notNull(),
    /** Human-readable rejection reason */
    reason: varchar("reason", { length: 200 }).notNull(),
    /** Structured detail (validation errors, risk scores, provider error codes, etc.) */
    detail: jsonb("detail"),
    /** Symbol being traded at time of rejection */
    symbol: varchar("symbol", { length: 30 }),
    /** Execution mode at time of rejection */
    executionMode: varchar("execution_mode", { length: 20 }),
    /** Full error trace if available */
    errorTrace: text("error_trace"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_rejections_order_id_idx").on(table.orderId),
    index("exec_rejections_stage_idx").on(table.stage),
    index("exec_rejections_symbol_idx").on(table.symbol),
    index("exec_rejections_created_at_idx").on(table.createdAt),
  ],
);

export const insertExecutionRejectionSchema = createInsertSchema(executionRejectionsTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionRejectionSchema = createSelectSchema(executionRejectionsTable);

export type InsertExecutionRejection = z.infer<typeof insertExecutionRejectionSchema>;
export type ExecutionRejection = typeof executionRejectionsTable.$inferSelect;
