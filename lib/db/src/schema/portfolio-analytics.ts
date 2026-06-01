import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * portfolio_analytics — top-level analytics snapshot for a paper account.
 * Aggregates performance, health, attribution, and diversification metrics
 * into a single queryable record. Refreshed periodically by the analytics scheduler.
 */
export const portfolioAnalyticsTable = pgTable(
  "portfolio_analytics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** Snapshot timestamp */
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
    /** Total return since account inception (%) */
    totalReturnPct: numeric("total_return_pct", { precision: 12, scale: 6 }),
    /** Net return after all costs (%) */
    netReturnPct: numeric("net_return_pct", { precision: 12, scale: 6 }),
    /** Annualized return (CAGR) since inception (%) */
    annualizedReturnPct: numeric("annualized_return_pct", { precision: 12, scale: 6 }),
    /** Volatility (annualized standard deviation of daily returns, %) */
    volatilityPct: numeric("volatility_pct", { precision: 12, scale: 6 }),
    /** Sharpe ratio */
    sharpeRatio: numeric("sharpe_ratio", { precision: 10, scale: 6 }),
    /** Maximum drawdown since inception (%) */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 6 }),
    /** Overall health score (0–100) */
    healthScore: numeric("health_score", { precision: 6, scale: 2 }),
    /** Health grade: A | B | C | D | F */
    healthGrade: varchar("health_grade", { length: 1 }),
    /** Diversification score (0–100) */
    diversificationScore: numeric("diversification_score", { precision: 6, scale: 2 }),
    /** Capital efficiency score (0–100) */
    capitalEfficiencyScore: numeric("capital_efficiency_score", { precision: 6, scale: 2 }),
    /** Number of active strategies */
    activeStrategies: integer("active_strategies").default(0),
    /** Number of open positions */
    openPositions: integer("open_positions").default(0),
    /** Total trades (closed) */
    totalTrades: integer("total_trades").default(0),
    /** Current equity */
    currentEquity: numeric("current_equity", { precision: 18, scale: 8 }),
    /** Peak equity */
    peakEquity: numeric("peak_equity", { precision: 18, scale: 8 }),
    /** Current cash balance */
    cashBalance: numeric("cash_balance", { precision: 18, scale: 8 }),
    /** Total unrealized P&L */
    unrealizedPnl: numeric("unrealized_pnl", { precision: 18, scale: 8 }),
    /** Total realized P&L */
    realizedPnl: numeric("realized_pnl", { precision: 18, scale: 8 }),
    /** Days since account inception */
    daysSinceInception: integer("days_since_inception").default(0),
    /** Metadata JSON blob for extended metrics */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_analytics_account_idx").on(table.accountId),
    index("portfolio_analytics_snapshot_at_idx").on(table.snapshotAt),
  ],
);

export const insertPortfolioAnalyticsSchema = createInsertSchema(portfolioAnalyticsTable).omit({
  id: true,
  createdAt: true,
});
export const selectPortfolioAnalyticsSchema = createSelectSchema(portfolioAnalyticsTable);

export type InsertPortfolioAnalytics = z.infer<typeof insertPortfolioAnalyticsSchema>;
export type PortfolioAnalytics = typeof portfolioAnalyticsTable.$inferSelect;
