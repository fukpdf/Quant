import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";
import { paperOrdersTable } from "./paper-orders";

/**
 * Execution records — the outcome of the paper execution engine processing an order.
 * One row per order processed by the engine (whether successful or rejected).
 * Captures the simulation parameters used and the result.
 */
export const paperExecutionsTable = pgTable(
  "paper_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => paperOrdersTable.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** Whether the execution simulation succeeded */
    success: boolean("success").notNull(),
    /** failure reason if success = false */
    failureReason: text("failure_reason"),
    /** Price at the moment the execution engine ran */
    marketPrice: numeric("market_price", { precision: 20, scale: 8 }).notNull(),
    /** Final executed price (post-slippage) */
    executedPrice: numeric("executed_price", { precision: 20, scale: 8 }),
    /** Quantity executed */
    executedQuantity: numeric("executed_quantity", { precision: 20, scale: 8 }),
    /** Commission applied */
    commission: numeric("commission", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Slippage applied */
    slippage: numeric("slippage", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Simulated processing latency in ms */
    latencyMs: numeric("latency_ms", { precision: 10, scale: 2 }).notNull().default("0"),
    executedAt: timestamp("executed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_executions_order_id_idx").on(table.orderId),
    index("paper_executions_account_id_idx").on(table.accountId),
    index("paper_executions_executed_at_idx").on(table.executedAt),
  ],
);

export const insertPaperExecutionSchema = createInsertSchema(paperExecutionsTable).omit({
  id: true,
  executedAt: true,
});

export const selectPaperExecutionSchema = createSelectSchema(paperExecutionsTable);

export type InsertPaperExecution = z.infer<typeof insertPaperExecutionSchema>;
export type PaperExecution = typeof paperExecutionsTable.$inferSelect;
