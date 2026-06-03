import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * alert_events — fired alert instances.
 * Every time an alert rule triggers, a new event row is created.
 * Lifecycle: active → acknowledged → resolved.
 */
export const alertEventsTable = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Reference to the alert_rules.name that triggered this */
    ruleName: varchar("rule_name", { length: 100 }).notNull(),
    /** Warning | Critical | Emergency (denormalized for query convenience) */
    severity: varchar("severity", { length: 20 }).notNull(),
    /** active | acknowledged | resolved */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    /** Alert title */
    title: varchar("title", { length: 300 }).notNull(),
    /** Full alert message with context */
    message: varchar("message", { length: 2000 }).notNull(),
    /** Which service or subsystem triggered this alert */
    service: varchar("service", { length: 100 }),
    /** Metric value that triggered the alert */
    triggerValue: varchar("trigger_value", { length: 100 }),
    /** Threshold that was exceeded */
    thresholdValue: varchar("threshold_value", { length: 100 }),
    /** Structured context payload */
    details: jsonb("details"),
    /** When this alert was fired */
    firedAt: timestamp("fired_at", { withTimezone: true }).notNull().defaultNow(),
    /** When this alert was acknowledged */
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    /** When this alert was resolved */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_events_status_idx").on(table.status),
    index("alert_events_severity_idx").on(table.severity),
    index("alert_events_rule_name_idx").on(table.ruleName),
    index("alert_events_fired_at_idx").on(table.firedAt),
    index("alert_events_service_idx").on(table.service),
  ],
);

export const insertAlertEventsSchema = createInsertSchema(alertEventsTable).omit({
  id: true,
  createdAt: true,
  firedAt: true,
});
export const selectAlertEventsSchema = createSelectSchema(alertEventsTable);

export type InsertAlertEvent = z.infer<typeof insertAlertEventsSchema>;
export type AlertEvent = typeof alertEventsTable.$inferSelect;
