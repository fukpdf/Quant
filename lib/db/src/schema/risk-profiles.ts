import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Risk profiles — named capital protection configurations.
 * Each profile defines the full set of limits and tolerances
 * applied by the pre-trade risk engine.
 *
 * Preset types: conservative | balanced | aggressive | research | custom
 */
export const riskProfilesTable = pgTable(
  "risk_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    /** conservative | balanced | aggressive | research | custom */
    profileType: varchar("profile_type", { length: 30 }).notNull().default("custom"),
    /** Max single position size as % of account equity */
    maxPositionSizePct: numeric("max_position_size_pct", { precision: 8, scale: 4 }).notNull().default("10"),
    /** Max total portfolio exposure as % of equity */
    maxPortfolioExposurePct: numeric("max_portfolio_exposure_pct", { precision: 8, scale: 4 }).notNull().default("80"),
    /** Max daily loss allowed (% of equity at start of day) */
    maxDailyLossPct: numeric("max_daily_loss_pct", { precision: 8, scale: 4 }).notNull().default("3"),
    /** Max account drawdown before trading halt */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 8, scale: 4 }).notNull().default("20"),
    /** Leverage limit placeholder — Phase 8 enforcement */
    maxLeverage: numeric("max_leverage", { precision: 6, scale: 2 }).notNull().default("1"),
    /** Max single-asset concentration as % of portfolio */
    concentrationLimitPct: numeric("concentration_limit_pct", { precision: 8, scale: 4 }).notNull().default("25"),
    /** Max weekly drawdown % before restriction */
    maxWeeklyLossPct: numeric("max_weekly_loss_pct", { precision: 8, scale: 4 }).notNull().default("7"),
    /** Min required strategy confidence score (0–100) to allow trading */
    minStrategyConfidenceScore: numeric("min_strategy_confidence_score", { precision: 6, scale: 2 }).notNull().default("0"),
    /** Max number of concurrent open positions */
    maxOpenPositions: integer("max_open_positions").notNull().default(20),
    /** Numeric risk tolerance score 1–10 (1 = most conservative) */
    riskToleranceScore: integer("risk_tolerance_score").notNull().default(5),
    /** Whether this is the system default profile */
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_profiles_type_idx").on(table.profileType),
    index("risk_profiles_is_default_idx").on(table.isDefault),
  ],
);

export const insertRiskProfileSchema = createInsertSchema(riskProfilesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectRiskProfileSchema = createSelectSchema(riskProfilesTable);

export type InsertRiskProfile = z.infer<typeof insertRiskProfileSchema>;
export type RiskProfile = typeof riskProfilesTable.$inferSelect;
