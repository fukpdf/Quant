import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Position sizing strategy profiles.
 * Attached to backtests to control how much capital is allocated per signal.
 *
 * method:
 *   fixed_dollar      — buy exactly N dollars per trade
 *   fixed_percentage  — buy N% of current portfolio equity
 *   risk_percentage   — size so a hypothetical stop equals N% of equity
 *   volatility_based  — size inversely proportional to recent ATR
 *   kelly             — full/fractional Kelly Criterion (research only; cap at maxPositionPct)
 */
export const positionSizingProfilesTable = pgTable(
  "position_sizing_profiles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    /** fixed_dollar | fixed_percentage | risk_percentage | volatility_based | kelly */
    method: varchar("method", { length: 30 }).notNull(),
    /** Primary sizing value: dollar amount, fraction (0-1), or risk pct */
    value: numeric("value", { precision: 12, scale: 6 }).notNull(),
    /** Hard cap: maximum fraction of portfolio per position (safety limiter) */
    maxPositionPct: numeric("max_position_pct", { precision: 8, scale: 6 }).notNull().default("1.0"),
    /** ATR lookback period (for volatility_based and risk_percentage methods) */
    atrPeriod: integer("atr_period").notNull().default(14),
    /** Risk multiple of ATR used as hypothetical stop distance (volatility_based) */
    atrRiskMultiple: numeric("atr_risk_multiple", { precision: 8, scale: 4 }).notNull().default("2.0"),
    /** Kelly fraction multiplier — 1.0 = full Kelly, 0.25 = quarter Kelly */
    kellyFraction: numeric("kelly_fraction", { precision: 8, scale: 4 }).notNull().default("0.25"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("position_sizing_method_idx").on(table.method),
    index("position_sizing_active_idx").on(table.isActive),
  ],
);

export const insertPositionSizingProfileSchema = createInsertSchema(
  positionSizingProfilesTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const selectPositionSizingProfileSchema = createSelectSchema(positionSizingProfilesTable);

export type InsertPositionSizingProfile = z.infer<typeof insertPositionSizingProfileSchema>;
export type PositionSizingProfile = typeof positionSizingProfilesTable.$inferSelect;
