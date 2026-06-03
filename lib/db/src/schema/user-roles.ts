import {
  pgTable,
  uuid,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { rolesTable } from "./roles";
import { organizationsTable } from "./organizations";

/**
 * User–Role assignments.
 * organizationId=null means a global assignment (applies across all orgs).
 * organizationId set means the role is scoped to that specific org.
 */
export const userRolesTable = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    /** null = global scope; set = org-scoped role */
    organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => usersTable.id, { onDelete: "set null" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    /** Optional expiry — null means permanent */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("user_roles_user_id_idx").on(table.userId),
    index("user_roles_role_id_idx").on(table.roleId),
    index("user_roles_org_id_idx").on(table.organizationId),
    index("user_roles_user_org_idx").on(table.userId, table.organizationId),
  ],
);

export const insertUserRoleSchema = createInsertSchema(userRolesTable).omit({
  id: true,
  createdAt: true,
  grantedAt: true,
});

export const selectUserRoleSchema = createSelectSchema(userRolesTable);

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRolesTable.$inferSelect;
