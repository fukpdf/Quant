import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Roles — named collections of permissions.
 * System roles (isSystem=true) are seeded on startup and cannot be deleted.
 * Roles: super_admin | org_owner | admin | portfolio_manager | trader | analyst | viewer
 */
export const rolesTable = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 50 }).notNull(),
    description: text("description"),
    /** System roles are seeded and cannot be deleted or renamed */
    isSystem: boolean("is_system").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("roles_name_idx").on(table.name),
    index("roles_is_system_idx").on(table.isSystem),
    index("roles_is_active_idx").on(table.isActive),
  ],
);

export const insertRoleSchema = createInsertSchema(rolesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectRoleSchema = createSelectSchema(rolesTable);

export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;
