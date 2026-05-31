import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Economic calendar events (CPI, NFP, Fed rate decisions, GDP, etc.).
 * Schema designed for future integration with providers (e.g. Investing.com API,
 * ForexFactory, Trading Economics). Currently populated manually or via future job.
 *
 * Impact levels correspond to market convention:
 *   low      — minimal expected market movement
 *   medium   — moderate expected movement
 *   high     — significant expected movement
 *   critical — historically extreme movement (FOMC, NFP, CPI surprises)
 */
export const economicEventsTable = pgTable(
  "economic_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    /** ISO 3166-1 alpha-2 country code (US, EU, GB, JP, CN, etc.) */
    country: varchar("country", { length: 10 }).notNull(),
    /** low | medium | high | critical */
    impact: varchar("impact", { length: 20 }).notNull().default("medium"),
    eventType: varchar("event_type", { length: 100 }),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    actualValue: varchar("actual_value", { length: 50 }),
    forecastValue: varchar("forecast_value", { length: 50 }),
    previousValue: varchar("previous_value", { length: 50 }),
    source: varchar("source", { length: 100 }),
    /** Raw JSON from provider for future parsing */
    rawData: text("raw_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("economic_events_scheduled_at_idx").on(table.scheduledAt),
    index("economic_events_country_idx").on(table.country),
    index("economic_events_impact_idx").on(table.impact),
  ],
);

export const insertEconomicEventSchema = createInsertSchema(
  economicEventsTable,
).omit({ id: true, createdAt: true, updatedAt: true });

export const selectEconomicEventSchema = createSelectSchema(economicEventsTable);

export type InsertEconomicEvent = z.infer<typeof insertEconomicEventSchema>;
export type EconomicEvent = typeof economicEventsTable.$inferSelect;
