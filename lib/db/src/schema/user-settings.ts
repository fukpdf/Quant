import {
  pgTable,
  uuid,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * User settings — security and account-level settings per user.
 * One row per user (one-to-one). Separate from preferences to allow
 * fine-grained permission control over security settings.
 */
export const userSettingsTable = pgTable(
  "user_settings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    /** Session inactivity timeout in minutes; 0 = no timeout */
    sessionTimeoutMinutes: integer("session_timeout_minutes").notNull().default(60),
    /** Force password change on next login */
    requirePasswordChangeOnLogin: boolean("require_password_change_on_login").notNull().default(false),
    allowMultipleSessions: boolean("allow_multiple_sessions").notNull().default(true),
    maxSessions: integer("max_sessions").notNull().default(5),
    emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
    /** Enables API key creation for this user */
    apiAccessEnabled: boolean("api_access_enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_settings_user_id_idx").on(table.userId),
  ],
);

export const insertUserSettingsSchema = createInsertSchema(userSettingsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectUserSettingsSchema = createSelectSchema(userSettingsTable);

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettingsTable.$inferSelect;
