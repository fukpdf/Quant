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
 * notification_channels — registered delivery destinations for alert notifications.
 * Supports email, webhook, and Slack-compatible endpoints.
 */
export const notificationChannelsTable = pgTable(
  "notification_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable channel name */
    name: varchar("name", { length: 100 }).notNull(),
    /** email | webhook | slack */
    channelType: varchar("channel_type", { length: 20 }).notNull(),
    /** Destination: email address, webhook URL, or Slack webhook URL */
    destination: text("destination").notNull(),
    /** Channel-specific configuration (headers, auth, templates) */
    config: jsonb("config"),
    /** Whether this channel is active */
    isActive: boolean("is_active").notNull().default(true),
    /** Alert severity levels that trigger this channel: warning | critical | emergency (comma-separated) */
    severityFilter: varchar("severity_filter", { length: 100 }).default("critical,emergency"),
    /** Max retries on delivery failure */
    maxRetries: integer("max_retries").default(3),
    /** Cooldown in seconds between deliveries of the same alert */
    cooldownSeconds: integer("cooldown_seconds").default(300),
    /** Total successful deliveries */
    successCount: integer("success_count").notNull().default(0),
    /** Total failed deliveries */
    failureCount: integer("failure_count").notNull().default(0),
    /** Timestamp of last successful delivery */
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    /** Timestamp of last failure */
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("notification_channels_type_idx").on(table.channelType),
    index("notification_channels_active_idx").on(table.isActive),
  ],
);

export const insertNotificationChannelSchema = createInsertSchema(notificationChannelsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  successCount: true,
  failureCount: true,
});
export const selectNotificationChannelSchema = createSelectSchema(notificationChannelsTable);

export type InsertNotificationChannel = z.infer<typeof insertNotificationChannelSchema>;
export type NotificationChannel = typeof notificationChannelsTable.$inferSelect;
