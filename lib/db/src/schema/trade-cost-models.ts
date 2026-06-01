import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Commission and slippage configuration profiles.
 * Each backtest can reference a named cost model, or use the
 * zero-cost default (no FK → Phase 3 backward-compatible).
 *
 * commissionType:
 *   flat         — fixed dollar amount per trade side
 *   percentage   — fraction of trade notional value
 *   maker_taker  — separate maker/taker fees (common in crypto)
 *
 * slippageType:
 *   fixed            — constant price impact in quote units
 *   percentage       — fraction of execution price
 *   volatility_based — slippage scales with recent price std-dev
 *   volume_based     — slippage scales with (order_size / candle_volume)
 */
export const tradeCostModelsTable = pgTable(
  "trade_cost_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    /** Exchange profile label for informational purposes */
    exchangeProfile: varchar("exchange_profile", { length: 50 }).notNull().default("custom"),
    /** flat | percentage | maker_taker */
    commissionType: varchar("commission_type", { length: 20 }).notNull().default("percentage"),
    /** Used for flat and percentage commission types */
    commissionValue: numeric("commission_value", { precision: 12, scale: 8 }).notNull().default("0"),
    /** Maker fee rate (for maker_taker type) */
    makerFee: numeric("maker_fee", { precision: 12, scale: 8 }).notNull().default("0"),
    /** Taker fee rate (for maker_taker type) */
    takerFee: numeric("taker_fee", { precision: 12, scale: 8 }).notNull().default("0"),
    /** fixed | percentage | volatility_based | volume_based */
    slippageType: varchar("slippage_type", { length: 30 }).notNull().default("percentage"),
    /** Slippage magnitude (meaning depends on type) */
    slippageValue: numeric("slippage_value", { precision: 12, scale: 8 }).notNull().default("0"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trade_cost_models_profile_idx").on(table.exchangeProfile),
    index("trade_cost_models_active_idx").on(table.isActive),
  ],
);

export const insertTradeCostModelSchema = createInsertSchema(tradeCostModelsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectTradeCostModelSchema = createSelectSchema(tradeCostModelsTable);

export type InsertTradeCostModel = z.infer<typeof insertTradeCostModelSchema>;
export type TradeCostModel = typeof tradeCostModelsTable.$inferSelect;
