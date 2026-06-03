import {
  pgTable,
  uuid,
  varchar,
  numeric,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionAccountsTable } from "./execution-accounts";

/**
 * Execution orders — the core OMS order table.
 *
 * Tracks the full order lifecycle through the state machine:
 * created → validated → risk_approved → routed → acknowledged →
 * partially_filled → filled | cancelled | rejected | failed | recovering
 *
 * Every status change is recorded in execution_order_events.
 *
 * order types: market | limit | stop | stop_limit | reduce_only | post_only
 * sides: buy | sell
 * tif: gtc (good-till-cancelled) | ioc (immediate-or-cancel) | fok (fill-or-kill)
 */
export const executionOrdersTable = pgTable(
  "execution_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => executionAccountsTable.id),
    /** market | limit | stop | stop_limit | reduce_only | post_only */
    orderType: varchar("order_type", { length: 20 }).notNull(),
    /** buy | sell */
    side: varchar("side", { length: 10 }).notNull(),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** Requested quantity */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Quantity filled so far */
    filledQuantity: numeric("filled_quantity", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Remaining quantity */
    remainingQuantity: numeric("remaining_quantity", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Limit price for limit/stop_limit orders */
    limitPrice: numeric("limit_price", { precision: 20, scale: 8 }),
    /** Stop trigger price for stop/stop_limit orders */
    stopPrice: numeric("stop_price", { precision: 20, scale: 8 }),
    /** Computed average fill price */
    avgFillPrice: numeric("avg_fill_price", { precision: 20, scale: 8 }),
    /** Market price at order creation */
    marketPriceAtOrder: numeric("market_price_at_order", { precision: 20, scale: 8 }),
    /**
     * Order state machine:
     * created | validated | risk_approved | routed | acknowledged |
     * partially_filled | filled | cancelled | rejected | failed | recovering
     */
    status: varchar("status", { length: 30 }).notNull().default("created"),
    /** simulation | paper | live_disabled */
    executionMode: varchar("execution_mode", { length: 20 }).notNull(),
    /** Time-in-force: gtc | ioc | fok */
    tif: varchar("tif", { length: 10 }).notNull().default("gtc"),
    /** Provider that received this order */
    routedTo: varchar("routed_to", { length: 30 }),
    /** Optional strategy that originated this order */
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Client-provided idempotency key */
    clientOrderId: varchar("client_order_id", { length: 100 }),
    /** Exchange-assigned order ID (populated on ACK) */
    externalOrderId: varchar("external_order_id", { length: 100 }),
    /** ID of risk decision that approved/rejected this order */
    riskDecisionId: uuid("risk_decision_id"),
    /** Risk check result: approved | rejected | bypassed */
    riskResult: varchar("risk_result", { length: 20 }),
    /** Reason if status = rejected or failed */
    rejectReason: text("reject_reason"),
    /** Rejection stage: validation | risk | routing | provider */
    rejectStage: varchar("reject_stage", { length: 20 }),
    /** Total commission paid */
    commission: numeric("commission", { precision: 20, scale: 8 }),
    commissionAsset: varchar("commission_asset", { length: 20 }),
    /** End-to-end latency in ms from creation to fill/rejection */
    totalLatencyMs: numeric("total_latency_ms", { precision: 10, scale: 2 }),
    /** Is this order part of a recovery flow? */
    isRecovery: boolean("is_recovery").notNull().default(false),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    routedAt: timestamp("routed_at", { withTimezone: true }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    filledAt: timestamp("filled_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    rejectedAt: timestamp("rejected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_orders_account_id_idx").on(table.accountId),
    index("exec_orders_symbol_idx").on(table.symbol),
    index("exec_orders_status_idx").on(table.status),
    index("exec_orders_mode_idx").on(table.executionMode),
    index("exec_orders_strategy_idx").on(table.strategyName),
    index("exec_orders_client_order_idx").on(table.clientOrderId),
    index("exec_orders_created_at_idx").on(table.createdAt),
  ],
);

export const insertExecutionOrderSchema = createInsertSchema(executionOrdersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectExecutionOrderSchema = createSelectSchema(executionOrdersTable);

export type InsertExecutionOrder = z.infer<typeof insertExecutionOrderSchema>;
export type ExecutionOrder = typeof executionOrdersTable.$inferSelect;
