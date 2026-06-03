import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

/**
 * Invitations — email-based invitations to join an organization.
 * Token is a secure random string; status transitions: pending → accepted|declined|expired.
 */
export const invitationsTable = pgTable(
  "invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    /** Role to assign when the invitation is accepted */
    roleToAssign: varchar("role_to_assign", { length: 30 }).notNull().default("member"),
    /** Secure opaque token sent in the invitation email */
    token: varchar("token", { length: 128 }).notNull(),
    /** pending | accepted | declined | expired */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    invitedBy: uuid("invited_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    acceptedBy: uuid("accepted_by").references(() => usersTable.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("invitations_token_idx").on(table.token),
    index("invitations_org_id_idx").on(table.organizationId),
    index("invitations_email_idx").on(table.email),
    index("invitations_status_idx").on(table.status),
  ],
);

export const insertInvitationSchema = createInsertSchema(invitationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectInvitationSchema = createSelectSchema(invitationsTable);

export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitationsTable.$inferSelect;
