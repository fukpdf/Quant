import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  text,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { strategyGenerationsTable } from "./strategy-generations";

/**
 * strategy_mutations — records every genetic operation applied to a generation.
 *
 * mutation_type: parameter_tweak | crossover | random | elitism
 *
 * Tracks how child individuals were created from parents, enabling
 * full lineage analysis and attribution of fitness improvements.
 */
export const strategyMutationsTable = pgTable(
  "strategy_mutations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The child individual produced by this mutation */
    generationId: uuid("generation_id")
      .notNull()
      .references(() => strategyGenerationsTable.id),
    /** Primary parent individual (before mutation) */
    parentGenerationId: uuid("parent_generation_id").notNull(),
    /** Secondary parent for crossover operations (null for single-parent ops) */
    secondaryParentId: uuid("secondary_parent_id"),
    /** parameter_tweak | crossover | random | elitism */
    mutationType: varchar("mutation_type", { length: 30 }).notNull(),
    /** Which parameters changed and their before/after values */
    parameterChanges: jsonb("parameter_changes").notNull().default({}),
    /** Mutation strength — how much parameters were perturbed (0–1) */
    mutationStrength: numeric("mutation_strength", { precision: 5, scale: 4 }),
    /** Fitness score of parent before mutation */
    parentFitness: numeric("parent_fitness", { precision: 10, scale: 6 }),
    /** Fitness score of child after mutation */
    childFitness: numeric("child_fitness", { precision: 10, scale: 6 }),
    /** Difference: childFitness - parentFitness (positive = improvement) */
    fitnessDelta: numeric("fitness_delta", { precision: 10, scale: 6 }),
    /** Whether child fitness > parent fitness */
    wasImprovement: boolean("was_improvement").notNull().default(false),
    /** Human/AI notes on why this mutation was chosen */
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_mutations_generation_id_idx").on(table.generationId),
    index("strategy_mutations_parent_id_idx").on(table.parentGenerationId),
    index("strategy_mutations_type_idx").on(table.mutationType),
    index("strategy_mutations_improvement_idx").on(table.wasImprovement),
  ],
);

export const insertStrategyMutationSchema = createInsertSchema(strategyMutationsTable).omit({
  id: true,
  createdAt: true,
});

export const selectStrategyMutationSchema = createSelectSchema(strategyMutationsTable);

export type InsertStrategyMutation = z.infer<typeof insertStrategyMutationSchema>;
export type StrategyMutation = typeof strategyMutationsTable.$inferSelect;
