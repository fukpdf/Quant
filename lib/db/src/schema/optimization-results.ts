import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { optimizationRunsTable } from "./optimization-runs";

/**
 * optimization_results — one row per iteration within an optimization_run.
 *
 * Stores the full parameter set and backtest outcome for each trial.
 * Enables optimization landscape visualization and Bayesian surrogate fitting.
 */
export const optimizationResultsTable = pgTable(
  "optimization_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Parent optimization campaign */
    runId: uuid("run_id")
      .notNull()
      .references(() => optimizationRunsTable.id),
    /** Sequential trial number within the run (1-based) */
    iterationNumber: integer("iteration_number").notNull(),
    /** Parameter set evaluated in this trial */
    parameters: jsonb("parameters").notNull().default({}),
    /** Objective score achieved (what is being maximized) */
    score: numeric("score", { precision: 10, scale: 6 }).notNull(),
    /** Sharpe ratio from this trial's backtest */
    sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 6 }),
    /** Sortino ratio */
    sortinoRatio: numeric("sortino_ratio", { precision: 10, scale: 6 }),
    /** Total return % */
    totalReturn: numeric("total_return", { precision: 10, scale: 6 }),
    /** Maximum drawdown % */
    maxDrawdown: numeric("max_drawdown", { precision: 10, scale: 6 }),
    /** Win rate 0–1 */
    winRate: numeric("win_rate", { precision: 8, scale: 6 }),
    /** Trade count */
    tradeCount: integer("trade_count"),
    /** Profit factor */
    profitFactor: numeric("profit_factor", { precision: 10, scale: 4 }),
    /** Whether this trial's score is the best seen so far */
    isBest: boolean("is_best").notNull().default(false),
    /** For Bayesian: expected improvement used to select this point */
    acquisitionValue: numeric("acquisition_value", { precision: 10, scale: 8 }),
    /** Wall-clock time in ms to run this trial */
    evaluationMs: numeric("evaluation_ms", { precision: 10, scale: 2 }),
    /** Linked strategy_generation row for genetic trials */
    generationId: uuid("generation_id"),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("optim_results_run_id_idx").on(table.runId),
    index("optim_results_is_best_idx").on(table.isBest),
    index("optim_results_score_idx").on(table.score),
    index("optim_results_iteration_idx").on(table.iterationNumber),
    index("optim_results_run_score_idx").on(table.runId, table.score),
  ],
);

export const insertOptimizationResultSchema = createInsertSchema(optimizationResultsTable).omit({
  id: true,
  createdAt: true,
});

export const selectOptimizationResultSchema = createSelectSchema(optimizationResultsTable);

export type InsertOptimizationResult = z.infer<typeof insertOptimizationResultSchema>;
export type OptimizationResult = typeof optimizationResultsTable.$inferSelect;
