import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Audit events — immutable, append-only audit trail for all user-initiated actions.
 * Records who did what to which resource and when.
 * Rows are never deleted or updated; this table is the immutable audit log.
 */
export const auditEventsTable = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id"),
    actorEmail: varchar("actor_email", { length: 255 }),
    /** Verb: e.g. "user.create", "role.assign", "password.reset", "session.revoke" */
    action: varchar("action", { length: 80 }).notNull(),
    /** Resource type: user | organization | team | role | permission | session | api_key | etc. */
    resource: varchar("resource", { length: 50 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    organizationId: uuid("organization_id"),
    /** Snapshot of the resource state before the action */
    beforeState: jsonb("before_state"),
    /** Snapshot of the resource state after the action */
    afterState: jsonb("after_state"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_events_actor_id_idx").on(table.actorId),
    index("audit_events_action_idx").on(table.action),
    index("audit_events_resource_idx").on(table.resource),
    index("audit_events_resource_id_idx").on(table.resourceId),
    index("audit_events_org_id_idx").on(table.organizationId),
    index("audit_events_created_at_idx").on(table.createdAt),
  ],
);

export const insertAuditEventSchema = createInsertSchema(auditEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectAuditEventSchema = createSelectSchema(auditEventsTable);

export type InsertAuditEvent = z.infer<typeof insertAuditEventSchema>;
export type AuditEvent = typeof auditEventsTable.$inferSelect;
