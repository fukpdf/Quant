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
 * asset_attribution — per-asset (symbol) contribution breakdown.
 * One row per symbol per attribution period.
 */
export const assetAttributionTable = pgTable(
  "asset_attribution",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Parent attribution run */
    attributionId: uuid("attribution_id").notNull(),
    accountId: uuid("account_id").notNull(),
    /** Symbol (e.g. BTCUSDT) */
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** Period start */
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    /** Period end */
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    /** Capital allocated to this asset (avg over period) */
    capitalAllocated: numeric("capital_allocated", { precision: 18, scale: 8 }),
    /** Capital allocation % of portfolio */
    capitalAllocationPct: numeric("capital_allocation_pct", { precision: 10, scale: 4 }),
    /** Asset P&L contribution */
    pnlContribution: numeric("pnl_contribution", { precision: 18, scale: 8 }),
    /** Return contribution % (asset pnl / total portfolio equity at start) */
    returnContributionPct: numeric("return_contribution_pct", { precision: 12, scale: 6 }),
    /** Asset-level return % */
    assetReturnPct: numeric("asset_return_pct", { precision: 12, scale: 6 }),
    /** Risk contribution % (concentration × volatility proxy) */
    riskContributionPct: numeric("risk_contribution_pct", { precision: 10, scale: 4 }),
    /** Max drawdown on this asset's trades */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 6 }),
    /** Win rate */
    winRatePct: numeric("win_rate_pct", { precision: 8, scale: 4 }),
    /** Trade count on this asset */
    tradeCount: integer("trade_count").default(0),
    /** Win count */
    winCount: integer("win_count").default(0),
    /** Loss count */
    lossCount: integer("loss_count").default(0),
    /** Asset ranking (1 = best contributor) */
    rank: integer("rank"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("asset_attribution_attribution_id_idx").on(table.attributionId),
    index("asset_attribution_account_idx").on(table.accountId),
    index("asset_attribution_symbol_idx").on(table.symbol),
  ],
);

export const insertAssetAttributionSchema = createInsertSchema(assetAttributionTable).omit({
  id: true,
  createdAt: true,
});
export const selectAssetAttributionSchema = createSelectSchema(assetAttributionTable);

export type InsertAssetAttribution = z.infer<typeof insertAssetAttributionSchema>;
export type AssetAttribution = typeof assetAttributionTable.$inferSelect;
