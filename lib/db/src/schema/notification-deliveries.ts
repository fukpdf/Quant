import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * notification_deliveries — delivery attempt records for alert notifications.
 * One row per delivery attempt (including retries).
 */
export const notificationDeliveriesTable = pgTable(
  "notification_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** FK to notification_channels */
    channelId: uuid("channel_id").notNull(),
    /** FK to alert_events */
    alertEventId: uuid("alert_event_id"),
    /** Alert rule name for reference */
    alertRuleName: varchar("alert_rule_name", { length: 100 }),
    /** Alert severity: warning | critical | emergency */
    severity: varchar("severity", { length: 20 }).notNull(),
    /** pending | delivering | delivered | failed | skipped */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** Attempt number (1 = first attempt, 2+ = retry) */
    attemptNumber: integer("attempt_number").notNull().default(1),
    /** Whether this was the final attempt */
    isFinal: boolean("is_final").notNull().default(false),
    /** HTTP status code or null for non-HTTP channels */
    responseCode: integer("response_code"),
    /** Response body or error message */
    responseBody: text("response_body"),
    /** Delivery duration in milliseconds */
    durationMs: integer("duration_ms"),
    /** Structured payload that was sent */
    payload: jsonb("payload"),
    /** Error detail for failed deliveries */
    errorDetail: text("error_detail"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_deliveries_channel_idx").on(table.channelId),
    index("notification_deliveries_alert_idx").on(table.alertEventId),
    index("notification_deliveries_status_idx").on(table.status),
    index("notification_deliveries_created_idx").on(table.createdAt),
  ],
);

export const insertNotificationDeliverySchema = createInsertSchema(notificationDeliveriesTable).omit({
  id: true,
  createdAt: true,
});
export const selectNotificationDeliverySchema = createSelectSchema(notificationDeliveriesTable);

export type InsertNotificationDelivery = z.infer<typeof insertNotificationDeliverySchema>;
export type NotificationDelivery = typeof notificationDeliveriesTable.$inferSelect;
