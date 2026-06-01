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
import { paperAccountsTable } from "./paper-accounts";
import { paperOrdersTable } from "./paper-orders";

/**
 * Paper trading fill records.
 * One row per simulated fill event (a single order may produce multiple fills).
 * Captures the exact price, quantity, and cost of each simulated execution.
 */
export const paperFillsTable = pgTable(
  "paper_fills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => paperOrdersTable.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** buy | sell */
    side: varchar("side", { length: 10 }).notNull(),
    /** Quantity filled in this event */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Raw price before slippage */
    rawPrice: numeric("raw_price", { precision: 20, scale: 8 }).notNull(),
    /** Fill price after slippage */
    fillPrice: numeric("fill_price", { precision: 20, scale: 8 }).notNull(),
    /** Commission charged for this fill */
    commission: numeric("commission", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Slippage impact in quote units */
    slippage: numeric("slippage", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Simulated latency in milliseconds */
    latencyMs: numeric("latency_ms", { precision: 10, scale: 2 }).notNull().default("0"),
    filledAt: timestamp("filled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_fills_order_id_idx").on(table.orderId),
    index("paper_fills_account_id_idx").on(table.accountId),
    index("paper_fills_symbol_idx").on(table.symbol),
    index("paper_fills_filled_at_idx").on(table.filledAt),
  ],
);

export const insertPaperFillSchema = createInsertSchema(paperFillsTable).omit({
  id: true,
  filledAt: true,
});

export const selectPaperFillSchema = createSelectSchema(paperFillsTable);

export type InsertPaperFill = z.infer<typeof insertPaperFillSchema>;
export type PaperFill = typeof paperFillsTable.$inferSelect;
