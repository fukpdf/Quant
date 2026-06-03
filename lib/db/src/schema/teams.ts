import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

/**
 * Teams — sub-groups within an organization.
 * Teams allow permission scoping at a finer granularity than the org level.
 */
export const teamsTable = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("teams_organization_id_idx").on(table.organizationId),
    index("teams_is_active_idx").on(table.isActive),
  ],
);

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectTeamSchema = createSelectSchema(teamsTable);

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
