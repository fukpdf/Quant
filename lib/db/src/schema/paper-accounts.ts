import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Virtual paper trading accounts.
 * Each account holds a distinct pool of virtual capital.
 * No real money. No broker connectivity. Simulation only.
 *
 * Status: active | paused | closed
 */
export const paperAccountsTable = pgTable(
  "paper_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable account label, e.g. "Main Account", "Aggressive Account" */
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    /** Starting virtual capital in quote currency (USD) */
    initialCapital: numeric("initial_capital", { precision: 20, scale: 8 }).notNull(),
    /** Current total equity (cash + unrealized position value) */
    currentEquity: numeric("current_equity", { precision: 20, scale: 8 }).notNull(),
    /** Cash balance not invested in any position */
    cashBalance: numeric("cash_balance", { precision: 20, scale: 8 }).notNull(),
    /** Available buying power (cash − reserved for open orders) */
    buyingPower: numeric("buying_power", { precision: 20, scale: 8 }).notNull(),
    /** Total realized PnL since account inception */
    realizedPnl: numeric("realized_pnl", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Mark-to-market unrealized PnL across all open positions */
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Placeholder for margin usage in future phases */
    marginUsed: numeric("margin_used", { precision: 20, scale: 8 }).notNull().default("0"),
    /** active | paused | closed */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_accounts_status_idx").on(table.status),
    index("paper_accounts_created_at_idx").on(table.createdAt),
  ],
);

export const insertPaperAccountSchema = createInsertSchema(paperAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPaperAccountSchema = createSelectSchema(paperAccountsTable);

export type InsertPaperAccount = z.infer<typeof insertPaperAccountSchema>;
export type PaperAccount = typeof paperAccountsTable.$inferSelect;
