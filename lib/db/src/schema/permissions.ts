import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Permissions — atomic capability grants.
 * Naming convention: <resource>:<action>
 * Resources: portfolio | research | risk | execution | ai | operations | users | billing
 * Actions: read | write | delete | admin
 */
export const permissionsTable = pgTable(
  "permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** e.g. "portfolio:read", "risk:admin" */
    name: varchar("name", { length: 80 }).notNull(),
    /** portfolio | research | risk | execution | ai | operations | users | billing */
    resource: varchar("resource", { length: 50 }).notNull(),
    /** read | write | delete | admin */
    action: varchar("action", { length: 20 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("permissions_name_idx").on(table.name),
    index("permissions_resource_idx").on(table.resource),
    index("permissions_action_idx").on(table.action),
  ],
);

export const insertPermissionSchema = createInsertSchema(permissionsTable).omit({
  id: true,
  createdAt: true,
});

export const selectPermissionSchema = createSelectSchema(permissionsTable);

export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type Permission = typeof permissionsTable.$inferSelect;
