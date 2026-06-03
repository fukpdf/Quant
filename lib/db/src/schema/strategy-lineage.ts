import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  text,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * strategy_lineage — tracks the evolutionary lineage of strategy variants.
 *
 * Records the family tree of strategy derivations — from the original seed
 * strategy through optimized variants, crossed/mutated GA individuals,
 * and manually-tuned forks.
 *
 * lineage_type: original | evolved | optimized | forked
 */
export const strategyLineageTable = pgTable(
  "strategy_lineage",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** This strategy/variant's identifier */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** Direct parent strategy name (null for originals) */
    parentStrategyName: varchar("parent_strategy_name", { length: 100 }),
    /** Ordered chain of ancestors from root to this node */
    ancestorChain: jsonb("ancestor_chain").notNull().default([]),
    /** Generation depth from the root (0 = original) */
    generationNumber: integer("generation_number").notNull().default(0),
    /** How many mutation operations were applied to produce this variant */
    mutationCount: integer("mutation_count").notNull().default(0),
    /** Fitness/score improvement over parent (positive = better) */
    improvementDelta: numeric("improvement_delta", { precision: 10, scale: 6 }),
    /** original | evolved | optimized | forked */
    lineageType: varchar("lineage_type", { length: 20 }).notNull().default("original"),
    /** Parameters of this variant */
    parameters: jsonb("parameters").notNull().default({}),
    /** How this variant was created */
    creationMethod: varchar("creation_method", { length: 30 }),
    /** Linked optimization run that produced this variant */
    optimizationRunId: uuid("optimization_run_id"),
    /** Linked GA generation that produced this variant */
    generationId: uuid("generation_id"),
    /** Notes on what was changed / why */
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_lineage_strategy_name_idx").on(table.strategyName),
    index("strategy_lineage_parent_name_idx").on(table.parentStrategyName),
    index("strategy_lineage_type_idx").on(table.lineageType),
    index("strategy_lineage_generation_idx").on(table.generationNumber),
    index("strategy_lineage_created_at_idx").on(table.createdAt),
  ],
);

export const insertStrategyLineageSchema = createInsertSchema(strategyLineageTable).omit({
  id: true,
  createdAt: true,
});

export const selectStrategyLineageSchema = createSelectSchema(strategyLineageTable);

export type InsertStrategyLineage = z.infer<typeof insertStrategyLineageSchema>;
export type StrategyLineage = typeof strategyLineageTable.$inferSelect;
