import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Registry of all data providers (Binance, forex brokers, stock data APIs, etc.).
 * A provider can serve multiple market types but each market type should have
 * at most one active provider at a time.
 */
export const marketProvidersTable = pgTable(
  "market_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 50 }).notNull().unique(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    description: text("description"),
    /** Comma-separated market types this provider supports (e.g. "crypto,futures") */
    supportedTypes: varchar("supported_types", { length: 200 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("inactive"),
    baseUrl: varchar("base_url", { length: 255 }),
    requiresAuth: boolean("requires_auth").notNull().default(false),
    /** JSON blob for provider-specific configuration (no secrets — those live in env vars) */
    configJson: text("config_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("market_providers_status_idx").on(table.status),
  ],
);

export const insertMarketProviderSchema = createInsertSchema(
  marketProvidersTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const selectMarketProviderSchema = createSelectSchema(marketProvidersTable);

export type InsertMarketProvider = z.infer<typeof insertMarketProviderSchema>;
export type MarketProvider = typeof marketProvidersTable.$inferSelect;
