import {
  pgTable,
  uuid,
  integer,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { strategyDefinitionsTable } from "./strategy-definitions";

/**
 * Immutable version history for strategy definitions.
 * Each time a strategy's parameter schema changes, a new version row is written.
 * This allows backtests to be reproduced using the exact parameter schema in use at run time.
 */
export const strategyVersionsTable = pgTable(
  "strategy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    strategyId: uuid("strategy_id")
      .notNull()
      .references(() => strategyDefinitionsTable.id),
    version: integer("version").notNull(),
    /** Snapshot of the parameter schema at this version */
    parameterSchema: text("parameter_schema").notNull(),
    /** Human-readable description of what changed in this version */
    changelog: text("changelog"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("strategy_versions_strategy_version_uidx").on(
      table.strategyId,
      table.version,
    ),
    index("strategy_versions_strategy_id_idx").on(table.strategyId),
  ],
);

export const insertStrategyVersionSchema = createInsertSchema(
  strategyVersionsTable,
).omit({ id: true, createdAt: true });

export const selectStrategyVersionSchema = createSelectSchema(strategyVersionsTable);

export type InsertStrategyVersion = z.infer<typeof insertStrategyVersionSchema>;
export type StrategyVersion = typeof strategyVersionsTable.$inferSelect;
