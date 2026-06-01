import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * portfolio_benchmarks — benchmark definitions for portfolio comparison.
 * Supports BTC, ETH, custom single-asset, and multi-asset basket benchmarks.
 */
export const portfolioBenchmarksTable = pgTable(
  "portfolio_benchmarks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    /** btc | eth | sol | custom | basket */
    benchmarkType: varchar("benchmark_type", { length: 30 }).notNull().default("custom"),
    /** Primary symbol (e.g. BTCUSDT) — null for basket */
    symbol: varchar("symbol", { length: 30 }),
    /** For basket benchmarks: JSON array of { symbol, weight } */
    basketComposition: jsonb("basket_composition"),
    /** Whether this is the default benchmark for all accounts */
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    /** Latest benchmark price */
    latestPrice: numeric("latest_price", { precision: 18, scale: 8 }),
    /** Latest price timestamp */
    latestPriceAt: timestamp("latest_price_at", { withTimezone: true }),
    /** Return since platform inception (%) */
    inceptionReturnPct: numeric("inception_return_pct", { precision: 12, scale: 6 }),
    /** 30-day return (%) */
    return30dPct: numeric("return_30d_pct", { precision: 12, scale: 6 }),
    /** 90-day return (%) */
    return90dPct: numeric("return_90d_pct", { precision: 12, scale: 6 }),
    /** Annualized volatility (%) */
    volatilityPct: numeric("volatility_pct", { precision: 12, scale: 6 }),
    /** Max drawdown (%) */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 12, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_benchmarks_type_idx").on(table.benchmarkType),
    index("portfolio_benchmarks_symbol_idx").on(table.symbol),
    index("portfolio_benchmarks_is_default_idx").on(table.isDefault),
  ],
);

export const insertPortfolioBenchmarkSchema = createInsertSchema(portfolioBenchmarksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectPortfolioBenchmarkSchema = createSelectSchema(portfolioBenchmarksTable);

export type InsertPortfolioBenchmark = z.infer<typeof insertPortfolioBenchmarkSchema>;
export type PortfolioBenchmark = typeof portfolioBenchmarksTable.$inferSelect;
