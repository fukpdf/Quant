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
 * incident_timeline — chronological event log for each incident.
 * Immutable: events are never updated or deleted.
 */
export const incidentTimelineTable = pgTable(
  "incident_timeline",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Reference to incidents.id */
    incidentId: uuid("incident_id").notNull(),
    /** opened | update | investigating | resolved | alert_linked | auto_detected */
    eventType: varchar("event_type", { length: 50 }).notNull(),
    /** Human-readable description of this timeline event */
    message: text("message").notNull(),
    /** Who or what created this event: system | operator */
    actor: varchar("actor", { length: 100 }).notNull().default("system"),
    /** Structured payload for this event */
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("incident_timeline_incident_id_idx").on(table.incidentId),
    index("incident_timeline_created_idx").on(table.createdAt),
  ],
);

export const insertIncidentTimelineSchema = createInsertSchema(incidentTimelineTable).omit({
  id: true,
  createdAt: true,
});
export const selectIncidentTimelineSchema = createSelectSchema(incidentTimelineTable);

export type InsertIncidentTimeline = z.infer<typeof insertIncidentTimelineSchema>;
export type IncidentTimeline = typeof incidentTimelineTable.$inferSelect;
