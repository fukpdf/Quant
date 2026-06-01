import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * strategy_attribution — per-strategy contribution breakdown for an attribution run.
 * One row per strategy per attribution period.
 */
export const strategyAttributionTable = pgTable(
  "strategy_attribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Parent attribution run */
    attributionId: uuid("attribution_id").notNull(),
    accountId: uuid("account_id").notNull(),
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** Period start */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    /** Period end */
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Capital allocated to this strategy (avg over period) */
    capitalAllocated: numeric("capital_allocated", { precision: 18, scale: 8 }),
    /** Capital allocation % of portfolio */
    capitalAllocationPct: numeric("capital_allocation_pct", { precision: 10, scale: 4 }),
    /** Strategy P&L contribution */
    pnlContribution: numeric("pnl_contribution", { precision: 18, scale: 8 }),
    /** Return contribution % (strategy pnl / total portfolio equity at start) */
    returnContributionPct: numeric("return_contribution_pct", { precision: 12, scale: 6 }),
    /** Strategy-level return % (strategy pnl / strategy capital) */
    strategyReturnPct: numeric("strategy_return_pct", { precision: 12, scale: 6 }),
    /** Risk contribution (% of portfolio volatility from this strategy) */
    riskContributionPct: numeric("risk_contribution_pct", { precision: 10, scale: 4 }),
    /** Sharpe contribution score */
    sharpeContribution: numeric("sharpe_contribution", { precision: 10, scale: 6 }),
    /** Max drawdown this strategy caused */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 6 }),
    /** Win rate for the period */
    winRatePct: numeric("win_rate_pct", { precision: 8, scale: 4 }),
    /** Number of trades */
    tradeCount: integer("trade_count").default(0),
    /** Number of winning trades */
    winCount: integer("win_count").default(0),
    /** Number of losing trades */
    lossCount: integer("loss_count").default(0),
    /** Strategy ranking within this period (1 = best) */
    rank: integer("rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_attribution_attribution_id_idx").on(table.attributionId),
    index("strategy_attribution_account_idx").on(table.accountId),
    index("strategy_attribution_strategy_idx").on(table.strategyName),
  ],
);

export const insertStrategyAttributionSchema = createInsertSchema(strategyAttributionTable).omit({
  id: true,
  createdAt: true,
});
export const selectStrategyAttributionSchema = createSelectSchema(strategyAttributionTable);

export type InsertStrategyAttribution = z.infer<typeof insertStrategyAttributionSchema>;
export type StrategyAttribution = typeof strategyAttributionTable.$inferSelect;
