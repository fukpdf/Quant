import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Execution audit log — immutable record of all execution actions.
 *
 * Every significant execution operation creates an entry here.
 * Records are NEVER updated or deleted.
 * Indexed for fast queryability by action, order, and time range.
 */
export const executionAuditLogTable = pgTable(
  "execution_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Related order ID (null for account-level actions) */
    orderId: uuid("order_id"),
    /** Related account ID */
    accountId: uuid("account_id"),
    /**
     * Action type:
     * order_created | order_validated | order_risk_approved | order_risk_rejected |
     * order_routed | order_acknowledged | order_filled | order_partially_filled |
     * order_cancelled | order_rejected | order_failed | order_recovering |
     * position_opened | position_closed | position_updated |
     * session_started | session_stopped | kill_switch_activated |
     * recovery_triggered | recovery_resolved | analytics_computed
     */
    action: varchar("action", { length: 50 }).notNull(),
    /** Who performed this action: oms | risk_engine | provider | monitor | scheduler | recovery | user */
    actor: varchar("actor", { length: 30 }).notNull().default("oms"),
    /** Execution mode context */
    executionMode: varchar("execution_mode", { length: 20 }),
    /** Symbol if applicable */
    symbol: varchar("symbol", { length: 30 }),
    /** Structured payload for this action */
    detail: jsonb("detail"),
    /** Did this action succeed? */
    success: boolean("success").notNull().default(true),
    /** Error message if success = false */
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_audit_order_id_idx").on(table.orderId),
    index("exec_audit_account_id_idx").on(table.accountId),
    index("exec_audit_action_idx").on(table.action),
    index("exec_audit_actor_idx").on(table.actor),
    index("exec_audit_symbol_idx").on(table.symbol),
    index("exec_audit_created_at_idx").on(table.createdAt),
  ],
);

export const insertExecutionAuditLogSchema = createInsertSchema(executionAuditLogTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionAuditLogSchema = createSelectSchema(executionAuditLogTable);

export type InsertExecutionAuditLog = z.infer<typeof insertExecutionAuditLogSchema>;
export type ExecutionAuditLog = typeof executionAuditLogTable.$inferSelect;
