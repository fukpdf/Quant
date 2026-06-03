import {
  pgTable,
  uuid,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { rolesTable } from "./roles";
import { permissionsTable } from "./permissions";

/**
 * Role–Permission junction table.
 * Defines which permissions each role grants.
 */
export const rolePermissionsTable = pgTable(
  "role_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissionsTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("role_permissions_role_perm_idx").on(table.roleId, table.permissionId),
    index("role_permissions_role_id_idx").on(table.roleId),
    index("role_permissions_permission_id_idx").on(table.permissionId),
  ],
);

export const insertRolePermissionSchema = createInsertSchema(rolePermissionsTable).omit({
  id: true,
  createdAt: true,
});

export const selectRolePermissionSchema = createSelectSchema(rolePermissionsTable);

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
