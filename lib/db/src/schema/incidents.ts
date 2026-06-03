import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * incidents — operational incidents automatically created when critical failures occur.
 * Lifecycle: open → investigating → resolved.
 */
export const incidentsTable = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Short incident title */
    title: varchar("title", { length: 300 }).notNull(),
    /** Detailed incident description */
    description: text("description"),
    /** warning | critical | emergency */
    severity: varchar("severity", { length: 20 }).notNull(),
    /** open | investigating | resolved */
    status: varchar("status", { length: 20 }).notNull().default("open"),
    /** Which services are affected — array of service names */
    affectedServices: jsonb("affected_services").notNull().default([]),
    /** Root cause analysis (populated when resolved) */
    rootCause: text("root_cause"),
    /** Resolution notes (populated when resolved) */
    resolution: text("resolution"),
    /** Source that triggered the incident: scheduler_failure | db_failure | risk_violation | stream_failure | ai_failure | execution_failure | manual */
    triggerSource: varchar("trigger_source", { length: 80 }),
    /** Reference ID from the triggering system (e.g. alert_event ID) */
    triggerRef: varchar("trigger_ref", { length: 100 }),
    /** When the incident was opened */
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    /** When investigation started */
    investigatingAt: timestamp("investigating_at", { withTimezone: true }),
    /** When the incident was resolved */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("incidents_status_idx").on(table.status),
    index("incidents_severity_idx").on(table.severity),
    index("incidents_opened_at_idx").on(table.openedAt),
  ],
);

export const insertIncidentsSchema = createInsertSchema(incidentsTable).omit({
  id: true,
  createdAt: true,
  openedAt: true,
});
export const selectIncidentsSchema = createSelectSchema(incidentsTable);

export type InsertIncident = z.infer<typeof insertIncidentsSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
