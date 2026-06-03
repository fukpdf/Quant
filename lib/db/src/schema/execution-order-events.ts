import {
  pgTable,
  uuid,
  varchar,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionOrdersTable } from "./execution-orders";

/**
 * Execution order events — immutable audit of every state transition.
 *
 * Every time an order moves between states, a record is created here.
 * This provides a complete, ordered history of the order lifecycle.
 * Records are NEVER updated or deleted.
 */
export const executionOrderEventsTable = pgTable(
  "execution_order_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => executionOrdersTable.id),
    /** State the order was in before this transition */
    fromStatus: varchar("from_status", { length: 30 }),
    /** State the order moved to */
    toStatus: varchar("to_status", { length: 30 }).notNull(),
    /** Event that triggered this transition (e.g. ValidationPassed, RiskApproved) */
    event: varchar("event", { length: 50 }).notNull(),
    /** Who triggered this event: oms | risk_engine | provider | monitor | recovery | user */
    actor: varchar("actor", { length: 30 }).notNull().default("oms"),
    /** Extra context (validation result, risk scores, provider response, etc.) */
    detail: jsonb("detail"),
    /** Time from previous event to this event in ms */
    latencyMs: numeric("latency_ms", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_order_events_order_id_idx").on(table.orderId),
    index("exec_order_events_to_status_idx").on(table.toStatus),
    index("exec_order_events_event_idx").on(table.event),
    index("exec_order_events_created_at_idx").on(table.createdAt),
  ],
);

export const insertExecutionOrderEventSchema = createInsertSchema(executionOrderEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionOrderEventSchema = createSelectSchema(executionOrderEventsTable);

export type InsertExecutionOrderEvent = z.infer<typeof insertExecutionOrderEventSchema>;
export type ExecutionOrderEvent = typeof executionOrderEventsTable.$inferSelect;
