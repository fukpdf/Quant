import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { executionOrdersTable } from "./execution-orders";

/**
 * Execution fills — individual fill events per order.
 *
 * An order may produce multiple fill records (partial fills).
 * The final state of an order is derived from the sum of all fill quantities.
 *
 * fill_type: full | partial
 * slippage_bps: signed — positive = filled worse than limit, negative = price improvement
 */
export const executionFillsTable = pgTable(
  "execution_fills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => executionOrdersTable.id),
    /** Price at which this fill occurred */
    fillPrice: numeric("fill_price", { precision: 20, scale: 8 }).notNull(),
    /** Quantity filled in this event */
    fillQuantity: numeric("fill_quantity", { precision: 20, scale: 8 }).notNull(),
    /** Commission for this fill */
    commission: numeric("commission", { precision: 20, scale: 8 }).notNull().default("0"),
    commissionAsset: varchar("commission_asset", { length: 20 }),
    /** True if this fill was as a market maker (post-only order) */
    isMaker: boolean("is_maker").notNull().default(false),
    /** Slippage in basis points vs limit price (signed) */
    slippageBps: numeric("slippage_bps", { precision: 10, scale: 4 }),
    /** Cumulative quantity filled including this event */
    cumulativeQty: numeric("cumulative_qty", { precision: 20, scale: 8 }).notNull(),
    /** Remaining quantity after this fill */
    remainingQty: numeric("remaining_qty", { precision: 20, scale: 8 }).notNull(),
    /** full | partial */
    fillType: varchar("fill_type", { length: 10 }).notNull().default("full"),
    /** Exchange-assigned fill/trade ID */
    exchangeFillId: varchar("exchange_fill_id", { length: 100 }),
    /** Latency from order creation to this fill in ms */
    fillLatencyMs: numeric("fill_latency_ms", { precision: 10, scale: 2 }),
    filledAt: timestamp("filled_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_fills_order_id_idx").on(table.orderId),
    index("exec_fills_filled_at_idx").on(table.filledAt),
    index("exec_fills_fill_type_idx").on(table.fillType),
  ],
);

export const insertExecutionFillSchema = createInsertSchema(executionFillsTable).omit({
  id: true,
  createdAt: true,
});

export const selectExecutionFillSchema = createSelectSchema(executionFillsTable);

export type InsertExecutionFill = z.infer<typeof insertExecutionFillSchema>;
export type ExecutionFill = typeof executionFillsTable.$inferSelect;
