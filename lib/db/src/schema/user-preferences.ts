import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * User preferences — UI and locale settings per user.
 * One row per user (one-to-one). Upserted on change.
 */
export const userPreferencesTable = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    /** dark | light | system */
    theme: varchar("theme", { length: 20 }).notNull().default("dark"),
    /** BCP-47 language tag, e.g. en, zh, de */
    language: varchar("language", { length: 10 }).notNull().default("en"),
    /** IANA timezone, e.g. UTC, America/New_York */
    timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
    dateFormat: varchar("date_format", { length: 20 }).notNull().default("YYYY-MM-DD"),
    /** JSON object: {email: bool, slack: bool, browser: bool, ...} */
    notifications: jsonb("notifications"),
    /** JSON layout config for dashboard widget arrangement */
    dashboardLayout: jsonb("dashboard_layout"),
    /** Default org shown on login */
    defaultOrganizationId: uuid("default_organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_preferences_user_id_idx").on(table.userId),
    index("user_preferences_org_id_idx").on(table.defaultOrganizationId),
  ],
);

export const insertUserPreferencesSchema = createInsertSchema(userPreferencesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectUserPreferencesSchema = createSelectSchema(userPreferencesTable);

export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferencesTable.$inferSelect;
