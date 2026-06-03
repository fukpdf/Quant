import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * strategy_generations — tracks genetic algorithm generations for strategy evolution.
 *
 * Each row represents one "individual" in a genetic population for a given strategy.
 * Generations evolve from a parent generation via crossover and mutation.
 *
 * status: pending | evaluating | evaluated | active | archived
 */
export const strategyGenerationsTable = pgTable(
  "strategy_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Base strategy name (e.g. "ema_crossover") */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** 0 = seed generation, N = Nth evolved generation */
    generationNumber: integer("generation_number").notNull().default(0),
    /** Which population this individual belongs to (evolution run UUID) */
    populationId: uuid("population_id").notNull(),
    /** Parent generation row (null for seed/generation 0 individuals) */
    parentGenerationId: uuid("parent_generation_id"),
    /** Parameter set for this individual */
    parameters: jsonb("parameters").notNull().default({}),
    /** Composite fitness score (higher = better) */
    fitnessScore: numeric("fitness_score", { precision: 10, scale: 6 }),
    /** Sharpe ratio from backtest evaluation */
    sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 6 }),
    /** Total return % from evaluation */
    totalReturn: numeric("total_return", { precision: 10, scale: 6 }),
    /** Maximum drawdown % from evaluation */
    maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 6 }),
    /** Trade count in evaluation window */
    tradeCount: integer("trade_count"),
    /** pending | evaluating | evaluated | active | archived */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** Symbol used for evaluation */
    evaluationSymbol: varchar("evaluation_symbol", { length: 30 }),
    /** Timeframe used for evaluation */
    evaluationTimeframe: varchar("evaluation_timeframe", { length: 10 }),
    /** Backtest run ID if linked to a formal backtest */
    backtestRunId: uuid("backtest_run_id"),
    /** Rank within the generation population (1 = best) */
    rankInGeneration: integer("rank_in_generation"),
    /** Whether this individual was selected for breeding */
    selectedForBreeding: integer("selected_for_breeding").notNull().default(0),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_gens_strategy_name_idx").on(table.strategyName),
    index("strategy_gens_population_id_idx").on(table.populationId),
    index("strategy_gens_generation_num_idx").on(table.generationNumber),
    index("strategy_gens_status_idx").on(table.status),
    index("strategy_gens_fitness_idx").on(table.fitnessScore),
    index("strategy_gens_parent_idx").on(table.parentGenerationId),
  ],
);

export const insertStrategyGenerationSchema = createInsertSchema(strategyGenerationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectStrategyGenerationSchema = createSelectSchema(strategyGenerationsTable);

export type InsertStrategyGeneration = z.infer<typeof insertStrategyGenerationSchema>;
export type StrategyGeneration = typeof strategyGenerationsTable.$inferSelect;
