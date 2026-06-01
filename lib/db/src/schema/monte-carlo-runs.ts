import {
  pgTable,
  uuid,
  varchar,
  integer,
  numeric,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { backtestRunsTable } from "./backtest-runs";

/**
 * Monte Carlo simulation results for a completed backtest run.
 *
 * The simulation randomly shuffles the completed trade sequence N times
 * to estimate the distribution of possible outcomes.
 *
 * percentiles: JSON object with p5, p10, p25, p50, p75, p90, p95 total return values.
 * worstCaseReturn / bestCaseReturn: absolute extremes observed across all simulations.
 */
export const monteCarloRunsTable = pgTable(
  "monte_carlo_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The completed backtest run whose trades are being simulated */
    backtestRunId: uuid("backtest_run_id")
      .notNull()
      .references(() => backtestRunsTable.id),
    /** Number of simulated iterations */
    simulations: integer("simulations").notNull(),
    /** Random seed for reproducibility (null = unseeded) */
    seed: integer("seed"),
    /** JSON percentile map: { p5, p10, p25, p50, p75, p90, p95 } */
    percentiles: text("percentiles"),
    /** Probability (0-1) of losing >= 50% of starting capital */
    probabilityOfRuin: numeric("probability_of_ruin", { precision: 8, scale: 6 }),
    /** Worst total return observed across all simulations */
    worstCaseReturn: numeric("worst_case_return", { precision: 12, scale: 8 }),
    /** Best total return observed across all simulations */
    bestCaseReturn: numeric("best_case_return", { precision: 12, scale: 8 }),
    /** Median (p50) total return across all simulations */
    medianReturn: numeric("median_return", { precision: 12, scale: 8 }),
    /** Standard deviation of simulated total returns */
    returnStdDev: numeric("return_std_dev", { precision: 12, scale: 8 }),
    /** pending | running | completed | failed */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("monte_carlo_run_id_idx").on(table.backtestRunId),
    index("monte_carlo_status_idx").on(table.status),
    index("monte_carlo_created_at_idx").on(table.createdAt),
  ],
);

export const insertMonteCarloRunSchema = createInsertSchema(monteCarloRunsTable).omit({
  id: true,
  createdAt: true,
});
export const selectMonteCarloRunSchema = createSelectSchema(monteCarloRunsTable);

export type InsertMonteCarloRun = z.infer<typeof insertMonteCarloRunSchema>;
export type MonteCarloRun = typeof monteCarloRunsTable.$inferSelect;
