import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";

/**
 * Strategy assignments — links a research strategy to a paper account.
 * Multiple strategies may be active on the same account simultaneously.
 * Assignment history is preserved (rows are never deleted — status changes).
 *
 * status: active | paused | disabled
 *
 * params stores the JSON-serialized strategy parameters override.
 * If null, the strategy's default parameters are used.
 */
export const paperStrategyAssignmentsTable = pgTable(
  "paper_strategy_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    /** Strategy name key, e.g. "ema_crossover" */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** Symbol this strategy trades, e.g. "BTCUSDT" */
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** Candle interval, e.g. "1h" */
    interval: varchar("interval", { length: 10 }).notNull(),
    /** JSON-serialized strategy parameter overrides (null = strategy defaults) */
    params: text("params"),
    /** active | paused | disabled */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    /** Reason for the last status change */
    statusReason: text("status_reason"),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_strategy_assignments_account_id_idx").on(table.accountId),
    index("paper_strategy_assignments_strategy_idx").on(table.strategyName),
    index("paper_strategy_assignments_status_idx").on(table.status),
  ],
);

export const insertPaperStrategyAssignmentSchema = createInsertSchema(
  paperStrategyAssignmentsTable,
).omit({ id: true, assignedAt: true, updatedAt: true });

export const selectPaperStrategyAssignmentSchema = createSelectSchema(
  paperStrategyAssignmentsTable,
);

export type InsertPaperStrategyAssignment = z.infer<typeof insertPaperStrategyAssignmentSchema>;
export type PaperStrategyAssignment = typeof paperStrategyAssignmentsTable.$inferSelect;
