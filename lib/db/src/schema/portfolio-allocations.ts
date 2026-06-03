import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * portfolio_allocations — computed portfolio weight sets.
 *
 * Supports five construction methods:
 *   equal_weight:          1/N across all strategies
 *   risk_parity:           weights inversely proportional to volatility
 *   volatility_targeting:  scale weights to hit a target portfolio volatility
 *   sharpe_maximization:   mean-variance optimization on the efficient frontier
 *   kelly:                 fractional Kelly from individual strategy win rates
 *
 * status: active | archived | draft
 */
export const portfolioAllocationsTable = pgTable(
  "portfolio_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable label for this allocation */
    allocationName: varchar("allocation_name", { length: 100 }).notNull(),
    /** equal_weight | risk_parity | volatility_targeting | sharpe_maximization | kelly */
    method: varchar("method", { length: 30 }).notNull(),
    /** Ordered list of strategy names included in this allocation */
    strategyNames: jsonb("strategy_names").notNull().default([]),
    /** Target weights map: { strategyName: weight } (sum ≈ 1.0) */
    targetWeights: jsonb("target_weights").notNull().default({}),
    /** Actual realized weights (may differ from target after rounding) */
    actualWeights: jsonb("actual_weights").notNull().default({}),
    /** Kelly fractions per strategy { strategyName: fraction } */
    kellyFractions: jsonb("kelly_fractions").notNull().default({}),
    /** Risk contribution per strategy { strategyName: risk_pct } */
    riskContributions: jsonb("risk_contributions").notNull().default({}),
    /** Portfolio-level constraint parameters used in construction */
    constraints: jsonb("constraints").notNull().default({}),
    /** Expected portfolio-level Sharpe ratio */
    expectedSharpe: numeric("expected_sharpe", { precision: 10, scale: 6 }),
    /** Expected annualized portfolio return % */
    expectedReturn: numeric("expected_return", { precision: 10, scale: 6 }),
    /** Expected annualized portfolio volatility % */
    expectedVolatility: numeric("expected_volatility", { precision: 10, scale: 6 }),
    /** Expected maximum drawdown % */
    expectedMaxDrawdown: numeric("expected_max_drawdown", { precision: 10, scale: 6 }),
    /** Diversification ratio (higher = more diversified) */
    diversificationRatio: numeric("diversification_ratio", { precision: 8, scale: 4 }),
    /** Whether this is the currently active allocation */
    isActive: boolean("is_active").notNull().default(false),
    /** active | archived | draft */
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    /** Regime this allocation was constructed for (null = regime-agnostic) */
    regimeId: uuid("regime_id"),
    /** Target volatility for volatility_targeting method */
    targetVolatility: numeric("target_volatility", { precision: 8, scale: 4 }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_alloc_method_idx").on(table.method),
    index("portfolio_alloc_status_idx").on(table.status),
    index("portfolio_alloc_is_active_idx").on(table.isActive),
    index("portfolio_alloc_regime_id_idx").on(table.regimeId),
    index("portfolio_alloc_computed_at_idx").on(table.computedAt),
  ],
);

export const insertPortfolioAllocationSchema = createInsertSchema(portfolioAllocationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectPortfolioAllocationSchema = createSelectSchema(portfolioAllocationsTable);

export type InsertPortfolioAllocation = z.infer<typeof insertPortfolioAllocationSchema>;
export type PortfolioAllocation = typeof portfolioAllocationsTable.$inferSelect;
