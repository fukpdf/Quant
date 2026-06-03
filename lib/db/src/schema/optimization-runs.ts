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
 * optimization_runs — one row per parameter optimization campaign.
 *
 * Supports four optimization methods:
 *   - grid_search:   exhaustive grid over the parameter space
 *   - random_search: random sampling of the parameter space
 *   - bayesian:      Gaussian process surrogate model
 *   - genetic:       GA population evolution (links to strategy_generations)
 *
 * objective: sharpe | calmar | total_return | sortino | profit_factor
 * status: pending | running | completed | failed | cancelled
 */
export const optimizationRunsTable = pgTable(
  "optimization_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Strategy being optimized */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** grid_search | random_search | bayesian | genetic */
    optimizationMethod: varchar("optimization_method", { length: 30 }).notNull(),
    /**
     * Parameter space definition:
     * { fast_period: { min: 5, max: 50, step: 1 }, ... }
     */
    parameterSpace: jsonb("parameter_space").notNull().default({}),
    /** Metric to maximize: sharpe | calmar | total_return | sortino | profit_factor */
    objective: varchar("objective", { length: 30 }).notNull().default("sharpe"),
    /** Symbol to backtest against */
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** Candle timeframe */
    timeframe: varchar("timeframe", { length: 10 }).notNull().default("1d"),
    /** Backtest start date */
    startDate: varchar("start_date", { length: 20 }).notNull(),
    /** Backtest end date */
    endDate: varchar("end_date", { length: 20 }).notNull(),
    /** pending | running | completed | failed | cancelled */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** Planned total iterations */
    totalIterations: integer("total_iterations").notNull().default(0),
    /** Iterations completed so far */
    completedIterations: integer("completed_iterations").notNull().default(0),
    /** Best objective score achieved */
    bestScore: numeric("best_score", { precision: 10, scale: 6 }),
    /** Parameter set that produced the best score */
    bestParameters: jsonb("best_parameters").notNull().default({}),
    /** Best Sharpe from the winning parameter set */
    bestSharpe: numeric("best_sharpe", { precision: 10, scale: 6 }),
    /** Best total return from the winning parameter set */
    bestTotalReturn: numeric("best_total_return", { precision: 10, scale: 6 }),
    /** Best max drawdown from the winning parameter set */
    bestMaxDrawdown: numeric("best_max_drawdown", { precision: 10, scale: 6 }),
    /** For genetic: linked population ID in strategy_generations */
    populationId: uuid("population_id"),
    /** For Bayesian: number of initial random exploration trials */
    explorationTrials: integer("exploration_trials"),
    /** For genetic: population size per generation */
    populationSize: integer("population_size"),
    /** For genetic: number of generations to evolve */
    maxGenerations: integer("max_generations"),
    /** Elapsed time in seconds */
    elapsedSeconds: numeric("elapsed_seconds", { precision: 10, scale: 2 }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("optim_runs_strategy_name_idx").on(table.strategyName),
    index("optim_runs_method_idx").on(table.optimizationMethod),
    index("optim_runs_status_idx").on(table.status),
    index("optim_runs_created_at_idx").on(table.createdAt),
    index("optim_runs_objective_idx").on(table.objective),
  ],
);

export const insertOptimizationRunSchema = createInsertSchema(optimizationRunsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectOptimizationRunSchema = createSelectSchema(optimizationRunsTable);

export type InsertOptimizationRun = z.infer<typeof insertOptimizationRunSchema>;
export type OptimizationRun = typeof optimizationRunsTable.$inferSelect;
