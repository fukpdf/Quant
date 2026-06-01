import {
  pgTable,
  uuid,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Periodic portfolio risk state snapshots.
 * Captured by the risk scheduler for trend analysis and retrospective review.
 * One row per account per scheduler tick.
 */
export const portfolioRiskSnapshotsTable = pgTable(
  "portfolio_risk_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** Total notional value of all open positions */
    totalExposure: numeric("total_exposure", { precision: 20, scale: 8 }).notNull().default("0"),
    /** totalExposure / current equity */
    portfolioExposurePct: numeric("portfolio_exposure_pct", { precision: 8, scale: 4 }).notNull().default("0"),
    /** Largest single position as % of equity */
    largestPositionPct: numeric("largest_position_pct", { precision: 8, scale: 4 }).notNull().default("0"),
    /** Herfindahl–Hirschman Index proxy for concentration 0–100 */
    concentrationScore: numeric("concentration_score", { precision: 6, scale: 2 }).notNull().default("0"),
    /** 1/concentrationScore normalized — higher = more diversified */
    diversificationScore: numeric("diversification_score", { precision: 6, scale: 2 }).notNull().default("100"),
    /** Composite portfolio health 0–100 */
    portfolioHealthScore: numeric("portfolio_health_score", { precision: 6, scale: 2 }).notNull().default("100"),
    /** Current daily drawdown % from today's opening equity */
    dailyDrawdownPct: numeric("daily_drawdown_pct", { precision: 8, scale: 4 }).notNull().default("0"),
    /** Current weekly drawdown % */
    weeklyDrawdownPct: numeric("weekly_drawdown_pct", { precision: 8, scale: 4 }).notNull().default("0"),
    /** All-time max drawdown % from peak equity */
    totalDrawdownPct: numeric("total_drawdown_pct", { precision: 8, scale: 4 }).notNull().default("0"),
    /** Number of open positions at snapshot time */
    openPositions: integer("open_positions").notNull().default(0),
    snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("portfolio_risk_snapshots_account_idx").on(table.accountId),
    index("portfolio_risk_snapshots_snapshot_at_idx").on(table.snapshotAt),
  ],
);

export const insertPortfolioRiskSnapshotSchema = createInsertSchema(portfolioRiskSnapshotsTable).omit({
  id: true,
  createdAt: true,
});

export const selectPortfolioRiskSnapshotSchema = createSelectSchema(portfolioRiskSnapshotsTable);

export type InsertPortfolioRiskSnapshot = z.infer<typeof insertPortfolioRiskSnapshotSchema>;
export type PortfolioRiskSnapshot = typeof portfolioRiskSnapshotsTable.$inferSelect;
