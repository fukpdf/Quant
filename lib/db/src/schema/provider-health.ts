import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Time-series log of provider health checks.
 * Each row represents one health probe result.
 * Retained for trend analysis and uptime reporting.
 */
export const providerHealthTable = pgTable(
  "provider_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerName: varchar("provider_name", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    latencyMs: integer("latency_ms"),
    errorMessage: text("error_message"),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("provider_health_provider_name_idx").on(table.providerName),
    index("provider_health_checked_at_idx").on(table.checkedAt),
    index("provider_health_provider_checked_idx").on(
      table.providerName,
      table.checkedAt,
    ),
  ],
);

export const insertProviderHealthSchema = createInsertSchema(
  providerHealthTable,
).omit({ id: true });

export const selectProviderHealthSchema = createSelectSchema(providerHealthTable);

export type InsertProviderHealth = z.infer<typeof insertProviderHealthSchema>;
export type ProviderHealth = typeof providerHealthTable.$inferSelect;
