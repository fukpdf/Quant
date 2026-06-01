import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tradeCostModelsTable } from "./trade-cost-models";
import { positionSizingProfilesTable } from "./position-sizing-profiles";

/**
 * Portfolio-level backtest runs across multiple symbols.
 * Capital is split equally across all symbols at the start.
 * Each symbol runs the same strategy independently, sharing the same
 * cost model and position sizing profile.
 *
 * symbols: JSON-serialised array of symbol strings, e.g. ["BTCUSDT","ETHUSDT"]
 * portfolioMetrics: JSON blob of aggregated portfolio-level performance.
 */
export const portfolioBacktestsTable = pgTable(
  "portfolio_backtests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }),
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** JSON array of symbol strings */
    symbols: text("symbols").notNull(),
    interval: varchar("interval", { length: 10 }).notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    parameters: text("parameters").notNull(),
    initialCapital: numeric("initial_capital", { precision: 16, scale: 4 }).notNull(),
    costModelId: uuid("cost_model_id").references(() => tradeCostModelsTable.id),
    positionSizingProfileId: uuid("position_sizing_profile_id").references(
      () => positionSizingProfilesTable.id,
    ),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    candlesProcessed: integer("candles_processed").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    /** JSON blob: portfolio-level performance metrics */
    portfolioMetrics: text("portfolio_metrics"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_backtests_strategy_idx").on(table.strategyName),
    index("portfolio_backtests_status_idx").on(table.status),
    index("portfolio_backtests_created_at_idx").on(table.createdAt),
  ],
);

export const insertPortfolioBacktestSchema = createInsertSchema(portfolioBacktestsTable).omit({
  id: true,
  createdAt: true,
});
export const selectPortfolioBacktestSchema = createSelectSchema(portfolioBacktestsTable);

export type InsertPortfolioBacktest = z.infer<typeof insertPortfolioBacktestSchema>;
export type PortfolioBacktest = typeof portfolioBacktestsTable.$inferSelect;
