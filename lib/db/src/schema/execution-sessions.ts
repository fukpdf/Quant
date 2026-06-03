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
import { executionAccountsTable } from "./execution-accounts";

/**
 * Execution sessions — tracks execution engine session lifecycle.
 *
 * A session starts when the execution scheduler initializes and ends on shutdown.
 * Provides a high-level view of execution activity per session.
 *
 * status: active | paused | stopped | error
 */
export const executionSessionsTable = pgTable(
  "execution_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => executionAccountsTable.id),
    /** simulation | paper | live_disabled */
    executionMode: varchar("execution_mode", { length: 20 }).notNull(),
    /** active provider for this session */
    provider: varchar("provider", { length: 30 }).notNull(),
    /** active | paused | stopped | error */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    /** Total orders placed in this session */
    ordersPlaced: numeric("orders_placed", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total orders filled */
    ordersFilled: numeric("orders_filled", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total orders rejected */
    ordersRejected: numeric("orders_rejected", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total orders cancelled */
    ordersCancelled: numeric("orders_cancelled", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Total fills processed */
    fillsProcessed: numeric("fills_processed", { precision: 10, scale: 0 }).notNull().default("0"),
    /** Error message if status = error */
    errorMessage: varchar("error_message", { length: 500 }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_sessions_account_id_idx").on(table.accountId),
    index("exec_sessions_mode_idx").on(table.executionMode),
    index("exec_sessions_status_idx").on(table.status),
    index("exec_sessions_started_at_idx").on(table.startedAt),
  ],
);

export const insertExecutionSessionSchema = createInsertSchema(executionSessionsTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionSessionSchema = createSelectSchema(executionSessionsTable);

export type InsertExecutionSession = z.infer<typeof insertExecutionSessionSchema>;
export type ExecutionSession = typeof executionSessionsTable.$inferSelect;
