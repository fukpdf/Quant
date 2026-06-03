import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Organizations — top-level tenant boundary.
 * All user activity is scoped to an organization.
 * A user may belong to multiple organizations via memberships.
 */
export const organizationsTable = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    /** URL-safe unique slug — used in paths and API context headers */
    slug: varchar("slug", { length: 50 }).notNull(),
    description: text("description"),
    logoUrl: text("logo_url"),
    /** Subscription plan: free | pro | enterprise */
    plan: varchar("plan", { length: 30 }).notNull().default("free"),
    isActive: boolean("is_active").notNull().default(true),
    maxMembers: integer("max_members").notNull().default(5),
    /** JSON config blob for org-level feature flags and settings */
    settings: jsonb("settings"),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organizations_slug_idx").on(table.slug),
    index("organizations_is_active_idx").on(table.isActive),
    index("organizations_plan_idx").on(table.plan),
  ],
);

export const insertOrganizationSchema = createInsertSchema(organizationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectOrganizationSchema = createSelectSchema(organizationsTable);

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type Organization = typeof organizationsTable.$inferSelect;
