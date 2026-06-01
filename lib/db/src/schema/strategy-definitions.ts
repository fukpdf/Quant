import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Registered strategy definitions.
 * One row per strategy type (e.g. ema_crossover, rsi_mean_reversion).
 * parameterSchema stores a JSON description of accepted parameters and their defaults.
 */
export const strategyDefinitionsTable = pgTable(
  "strategy_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    displayName: varchar("display_name", { length: 150 }).notNull(),
    description: text("description"),
    /** Serialized JSON describing configurable parameters and their defaults */
    parameterSchema: text("parameter_schema").notNull(),
    currentVersion: integer("current_version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_definitions_name_idx").on(table.name),
    index("strategy_definitions_active_idx").on(table.isActive),
  ],
);

export const insertStrategyDefinitionSchema = createInsertSchema(
  strategyDefinitionsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const selectStrategyDefinitionSchema = createSelectSchema(
  strategyDefinitionsTable,
);

export type InsertStrategyDefinition = z.infer<typeof insertStrategyDefinitionSchema>;
export type StrategyDefinition = typeof strategyDefinitionsTable.$inferSelect;
