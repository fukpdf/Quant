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

/**
 * Execution accounts — logical accounts for the execution engine.
 *
 * Each account has a fixed executionMode (simulation | paper | live_disabled).
 * LIVE mode is architecturally disabled — cannot be set without changing code.
 *
 * Links to a paper_account for capital tracking in paper/simulation modes.
 */
export const executionAccountsTable = pgTable(
  "execution_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable name for this execution account */
    name: varchar("name", { length: 100 }).notNull(),
    /** simulation | paper | live_disabled */
    executionMode: varchar("execution_mode", { length: 20 }).notNull().default("simulation"),
    /** Reference to paper_accounts.id for capital tracking */
    paperAccountId: uuid("paper_account_id"),
    /** Quote currency (USDT, USD, EUR, etc.) */
    currency: varchar("currency", { length: 20 }).notNull().default("USDT"),
    /** Current available balance */
    balance: numeric("balance", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Is this account actively accepting orders? */
    isActive: boolean("is_active").notNull().default(true),
    /** Kill switch — hard halt, cannot be bypassed by any order */
    isKillSwitchActive: boolean("is_kill_switch_active").notNull().default(false),
    /** Optional description */
    description: text("description"),
    /** Version counter for optimistic concurrency */
    version: numeric("version", { precision: 10, scale: 0 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("exec_accounts_mode_idx").on(table.executionMode),
    index("exec_accounts_active_idx").on(table.isActive),
    index("exec_accounts_paper_account_idx").on(table.paperAccountId),
  ],
);

export const insertExecutionAccountSchema = createInsertSchema(executionAccountsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectExecutionAccountSchema = createSelectSchema(executionAccountsTable);

export type InsertExecutionAccount = z.infer<typeof insertExecutionAccountSchema>;
export type ExecutionAccount = typeof executionAccountsTable.$inferSelect;
