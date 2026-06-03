import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

/**
 * Memberships — links a user to an organization with a base role.
 * org_role is the org-level role (owner | admin | member).
 * Fine-grained RBAC permissions are in user_roles.
 */
export const membershipsTable = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    /** org-level role: owner | admin | member */
    orgRole: varchar("org_role", { length: 30 }).notNull().default("member"),
    isActive: boolean("is_active").notNull().default(true),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    invitedBy: uuid("invited_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("memberships_user_org_idx").on(table.userId, table.organizationId),
    index("memberships_user_id_idx").on(table.userId),
    index("memberships_org_id_idx").on(table.organizationId),
    index("memberships_is_active_idx").on(table.isActive),
  ],
);

export const insertMembershipSchema = createInsertSchema(membershipsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  joinedAt: true,
});

export const selectMembershipSchema = createSelectSchema(membershipsTable);

export type InsertMembership = z.infer<typeof insertMembershipSchema>;
export type Membership = typeof membershipsTable.$inferSelect;
