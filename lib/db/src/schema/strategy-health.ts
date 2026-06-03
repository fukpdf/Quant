import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * strategy_health — per-strategy health snapshot.
 * Tracks active strategies, performance drift, consecutive losses, drawdown, and data freshness.
 * One row per strategy per health check cycle.
 */
export const strategyHealthTable = pgTable(
  "strategy_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Strategy name as registered in the strategy registry */
    strategyName: varchar("strategy_name", { length: 100 }).notNull(),
    /** healthy | warning | critical | inactive */
    status: varchar("status", { length: 30 }).notNull(),
    /** Composite health score 0–100 */
    healthScore: numeric("health_score", { precision: 5, scale: 1 }),
    /** Whether the strategy has an active paper trading assignment */
    isActive: boolean("is_active").notNull().default(false),
    /** Sharpe ratio from most recent backtest (numeric string) */
    lastSharpe: numeric("last_sharpe", { precision: 8, scale: 4 }),
    /** Max drawdown % from most recent backtest (numeric string) */
    lastMaxDrawdownPct: numeric("last_max_drawdown_pct", { precision: 8, scale: 4 }),
    /** Win rate from most recent backtest (numeric string, 0–1) */
    lastWinRate: numeric("last_win_rate", { precision: 6, scale: 4 }),
    /** Consecutive paper trading losses (live tracking) */
    consecutiveLosses: numeric("consecutive_losses", { precision: 6, scale: 0 }).notNull().default("0"),
    /** Current drawdown % in paper account */
    currentDrawdownPct: numeric("current_drawdown_pct", { precision: 8, scale: 4 }),
    /** Performance drift: difference between backtest Sharpe and live Sharpe */
    performanceDrift: numeric("performance_drift", { precision: 8, scale: 4 }),
    /** Age of most recent candle data in minutes */
    dataFreshnessMinutes: numeric("data_freshness_minutes", { precision: 8, scale: 1 }),
    /** Total backtest runs for this strategy */
    backtestCount: numeric("backtest_count", { precision: 8, scale: 0 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_health_name_idx").on(table.strategyName),
    index("strategy_health_name_created_idx").on(table.strategyName, table.createdAt),
    index("strategy_health_status_idx").on(table.status),
  ],
);

export const insertStrategyHealthSchema = createInsertSchema(strategyHealthTable).omit({
  id: true,
  createdAt: true,
});
export const selectStrategyHealthSchema = createSelectSchema(strategyHealthTable);

export type InsertStrategyHealth = z.infer<typeof insertStrategyHealthSchema>;
export type StrategyHealth = typeof strategyHealthTable.$inferSelect;
