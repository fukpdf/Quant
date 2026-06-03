import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * service_health — per-service health status snapshot.
 * One row per health check per service. Latest row = current health.
 * Tracks running/degraded/failed/maintenance state for every subsystem.
 */
export const serviceHealthTable = pgTable(
  "service_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Service identifier e.g. ingestion, paper_trading, risk_engine, streaming, execution, ai, intelligence */
    service: varchar("service", { length: 80 }).notNull(),
    /** running | degraded | failed | maintenance */
    status: varchar("status", { length: 30 }).notNull(),
    /** Composite health score 0–100 */
    healthScore: numeric("health_score", { precision: 5, scale: 1 }).notNull().default("100"),
    /** Whether the service is enabled */
    isEnabled: boolean("is_enabled").notNull().default(true),
    /** Human-readable status message */
    message: varchar("message", { length: 500 }),
    /** Structured details from the health check */
    details: jsonb("details"),
    /** Last successful check timestamp */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    /** Consecutive failure count */
    consecutiveFailures: numeric("consecutive_failures", { precision: 6, scale: 0 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("service_health_service_idx").on(table.service),
    index("service_health_service_created_idx").on(table.service, table.createdAt),
    index("service_health_status_idx").on(table.status),
  ],
);

export const insertServiceHealthSchema = createInsertSchema(serviceHealthTable).omit({
  id: true,
  createdAt: true,
});
export const selectServiceHealthSchema = createSelectSchema(serviceHealthTable);

export type InsertServiceHealth = z.infer<typeof insertServiceHealthSchema>;
export type ServiceHealth = typeof serviceHealthTable.$inferSelect;
