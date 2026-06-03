import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionOrdersTable } from "./execution-orders";

/**
 * Execution routes — records of routing decisions per order.
 *
 * Each time an order is sent to a provider (initial + retries), a route record is created.
 * Captures ACK latency and provider response for analytics.
 */
export const executionRoutesTable = pgTable(
  "execution_routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => executionOrdersTable.id),
    /** Provider this order was routed to: mock | paper | binance | forex | equities */
    provider: varchar("provider", { length: 30 }).notNull(),
    /** pending | acknowledged | rejected | timeout | error */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** Attempt number (1 = first, 2+ = retry) */
    attempt: numeric("attempt", { precision: 3, scale: 0 }).notNull().default("1"),
    /** Time from routing to ACK in ms */
    ackLatencyMs: numeric("ack_latency_ms", { precision: 10, scale: 2 }),
    /** External order ID returned by provider */
    externalOrderId: varchar("external_order_id", { length: 100 }),
    /** Error message from provider if status = rejected/error */
    errorMessage: text("error_message"),
    routedAt: timestamp("routed_at", { withTimezone: true }).notNull().defaultNow(),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_routes_order_id_idx").on(table.orderId),
    index("exec_routes_provider_idx").on(table.provider),
    index("exec_routes_status_idx").on(table.status),
    index("exec_routes_routed_at_idx").on(table.routedAt),
  ],
);

export const insertExecutionRouteSchema = createInsertSchema(executionRoutesTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionRouteSchema = createSelectSchema(executionRoutesTable);

export type InsertExecutionRoute = z.infer<typeof insertExecutionRouteSchema>;
export type ExecutionRoute = typeof executionRoutesTable.$inferSelect;
