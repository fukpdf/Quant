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
 * portfolio_attribution — top-level return attribution run for an account.
 * Captures the total portfolio P&L broken into contribution sources.
 */
export const portfolioAttributionTable = pgTable(
  "portfolio_attribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** Attribution window start */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    /** Attribution window end */
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Total P&L over the period */
    totalPnl: numeric("total_pnl", { precision: 18, scale: 8 }),
    /** Total return % */
    totalReturnPct: numeric("total_return_pct", { precision: 12, scale: 6 }),
    /** Long position P&L contribution */
    longPnl: numeric("long_pnl", { precision: 18, scale: 8 }),
    /** Short position P&L contribution */
    shortPnl: numeric("short_pnl", { precision: 18, scale: 8 }),
    /** Total commission paid */
    totalCommission: numeric("total_commission", { precision: 18, scale: 8 }),
    /** Total slippage cost */
    totalSlippage: numeric("total_slippage", { precision: 18, scale: 8 }),
    /** Number of strategies contributing */
    strategyCount: integer("strategy_count").default(0),
    /** Number of assets contributing */
    assetCount: integer("asset_count").default(0),
    /** Number of trades in the period */
    tradeCount: integer("trade_count").default(0),
    /** Best performing strategy name */
    topStrategyName: varchar("top_strategy_name", { length: 100 }),
    /** Worst performing strategy name */
    worstStrategyName: varchar("worst_strategy_name", { length: 100 }),
    /** Top contributing asset (symbol) */
    topAssetSymbol: varchar("top_asset_symbol", { length: 30 }),
    /** Worst contributing asset (symbol) */
    worstAssetSymbol: varchar("worst_asset_symbol", { length: 30 }),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_attribution_account_idx").on(table.accountId),
    index("portfolio_attribution_period_idx").on(table.periodStart, table.periodEnd),
  ],
);

export const insertPortfolioAttributionSchema = createInsertSchema(portfolioAttributionTable).omit({
  id: true,
  createdAt: true,
});
export const selectPortfolioAttributionSchema = createSelectSchema(portfolioAttributionTable);

export type InsertPortfolioAttribution = z.infer<typeof insertPortfolioAttributionSchema>;
export type PortfolioAttribution = typeof portfolioAttributionTable.$inferSelect;
