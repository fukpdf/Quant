import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Extended metadata for market instruments.
 * Supplements the core `markets` table with rich descriptive data that
 * is not needed for ingestion but is valuable for research and UI display.
 *
 * One row per symbol (unique). Created lazily — many markets will not have
 * a metadata row until data is fetched from an enrichment provider.
 */
export const marketMetadataTable = pgTable("market_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Foreign key to markets.symbol — enforced at app layer, not DB (for flexibility) */
  symbol: varchar("symbol", { length: 30 }).notNull().unique(),
  /** Market capitalisation in USD (crypto/stocks). Nullable — not applicable to forex. */
  marketCapUsd: numeric("market_cap_usd", { precision: 30, scale: 2 }),
  /** GICS sector or equivalent (Technology, Financials, Energy, Crypto, etc.) */
  sector: varchar("sector", { length: 100 }),
  industry: varchar("industry", { length: 100 }),
  description: text("description"),
  /** IANA timezone for the primary exchange (e.g. America/New_York, UTC) */
  timezone: varchar("timezone", { length: 50 }).default("UTC"),
  /** HH:MM format, exchange local time */
  tradingHoursStart: varchar("trading_hours_start", { length: 10 }),
  tradingHoursEnd: varchar("trading_hours_end", { length: 10 }),
  /** ISO 4217 currency code (USD, EUR, GBP, USDT, etc.) */
  currency: varchar("currency", { length: 10 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketMetadataSchema = createInsertSchema(
  marketMetadataTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const selectMarketMetadataSchema =
  createSelectSchema(marketMetadataTable);

export type InsertMarketMetadata = z.infer<typeof insertMarketMetadataSchema>;
export type MarketMetadata = typeof marketMetadataTable.$inferSelect;
