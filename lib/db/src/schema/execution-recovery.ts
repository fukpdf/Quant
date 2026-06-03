import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionOrdersTable } from "./execution-orders";

/**
 * Execution recovery — tracks recovery attempts for problematic orders.
 *
 * Detects and resolves: lost ACK, lost fill, provider timeout,
 * duplicate events, and disconnected sessions.
 *
 * Recovery actions: retry | reconcile | replay | repair | audit
 * Status: pending | success | failed
 */
export const executionRecoveryTable = pgTable(
  "execution_recovery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .references(() => executionOrdersTable.id),
    /**
     * Issue type that triggered recovery:
     * lost_ack | lost_fill | provider_timeout | duplicate_event | disconnected_session | stale_order
     */
    issue: varchar("issue", { length: 40 }).notNull(),
    /** Recovery action taken: retry | reconcile | replay | repair | audit */
    recoveryAction: varchar("recovery_action", { length: 20 }).notNull(),
    /** pending | success | failed */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** Structured context: what was detected and what was done */
    detail: jsonb("detail"),
    /** Provider involved in recovery */
    provider: varchar("provider", { length: 30 }),
    /** Execution mode at time of recovery */
    executionMode: varchar("execution_mode", { length: 20 }),
    /** Error message if status = failed */
    errorMessage: varchar("error_message", { length: 500 }),
    /** How many attempts were made */
    attempts: varchar("attempts", { length: 5 }).notNull().default("1"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_recovery_order_id_idx").on(table.orderId),
    index("exec_recovery_issue_idx").on(table.issue),
    index("exec_recovery_status_idx").on(table.status),
    index("exec_recovery_created_at_idx").on(table.createdAt),
  ],
);

export const insertExecutionRecoverySchema = createInsertSchema(executionRecoveryTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionRecoverySchema = createSelectSchema(executionRecoveryTable);

export type InsertExecutionRecovery = z.infer<typeof insertExecutionRecoverySchema>;
export type ExecutionRecovery = typeof executionRecoveryTable.$inferSelect;
