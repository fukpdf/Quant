import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * market_regimes — detected market regime periods per symbol.
 *
 * Regimes are detected by the RegimeDetectionEngine and represent the
 * prevailing market condition over a contiguous time window.
 *
 * regime_type: bull | bear | sideways | high_volatility | low_volatility
 * status: active | closed | superseded
 */
export const marketRegimesTable = pgTable(
  "market_regimes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Symbol this regime applies to (e.g. BTCUSDT or portfolio-level "_ALL_") */
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** bull | bear | sideways | high_volatility | low_volatility */
    regimeType: varchar("regime_type", { length: 30 }).notNull(),
    /** Confidence in regime classification 0–1 */
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 4 }).notNull(),
    /** When this regime period began */
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    /** When this regime ended (null = still active) */
    endAt: timestamp("end_at", { withTimezone: true }),
    /** active | closed | superseded */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    /** Detection method: heuristic | ml | ensemble */
    detectionMethod: varchar("detection_method", { length: 30 }).notNull().default("heuristic"),
    /** Lookback window in days used for detection */
    lookbackDays: numeric("lookback_days", { precision: 5, scale: 0 }).notNull().default("30"),
    /**
     * Raw indicator values at detection time:
     * { trend_slope, volatility_pct, adx, rsi_avg, volume_ratio }
     */
    indicators: jsonb("indicators").notNull().default({}),
    /** Arbitrary metadata (algorithm version, thresholds used, etc.) */
    metadata: jsonb("metadata").notNull().default({}),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_regimes_symbol_idx").on(table.symbol),
    index("market_regimes_type_idx").on(table.regimeType),
    index("market_regimes_status_idx").on(table.status),
    index("market_regimes_start_at_idx").on(table.startAt),
    index("market_regimes_symbol_status_idx").on(table.symbol, table.status),
  ],
);

export const insertMarketRegimeSchema = createInsertSchema(marketRegimesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectMarketRegimeSchema = createSelectSchema(marketRegimesTable);

export type InsertMarketRegime = z.infer<typeof insertMarketRegimeSchema>;
export type MarketRegime = typeof marketRegimesTable.$inferSelect;
