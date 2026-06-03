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
import { usersTable } from "./users";

/**
 * Security events — immutable record of all authentication and authorization events.
 * Used for security audit, brute-force detection, and anomaly alerting.
 */
export const securityEventsTable = pgTable(
  "security_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    /**
     * Event types: login_success | login_failure | logout | password_change |
     * password_reset_request | password_reset_complete | email_verified |
     * account_locked | account_unlocked | session_revoked | token_revoked |
     * api_key_created | api_key_revoked | role_assigned | role_revoked |
     * permission_denied | suspicious_activity | brute_force_detected |
     * invitation_sent | invitation_accepted | invitation_declined
     */
    eventType: varchar("event_type", { length: 60 }).notNull(),
    /** info | warning | critical */
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    details: jsonb("details"),
    organizationId: uuid("organization_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_events_user_id_idx").on(table.userId),
    index("security_events_event_type_idx").on(table.eventType),
    index("security_events_severity_idx").on(table.severity),
    index("security_events_created_at_idx").on(table.createdAt),
    index("security_events_ip_address_idx").on(table.ipAddress),
    index("security_events_org_id_idx").on(table.organizationId),
  ],
);

export const insertSecurityEventSchema = createInsertSchema(securityEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectSecurityEventSchema = createSelectSchema(securityEventsTable);

export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof securityEventsTable.$inferSelect;
