import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

/**
 * Sessions — server-side session records for JWT + device tracking.
 * One session per login event. Access tokens reference session IDs.
 * Revoke a session to invalidate all tokens derived from it.
 */
export const sessionsTable = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    /** SHA-256 hash of the most recently issued access token for this session */
    tokenHash: text("token_hash").notNull(),
    deviceInfo: jsonb("device_info"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    isRevoked: boolean("is_revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: varchar("revoked_reason", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_id_idx").on(table.userId),
    index("sessions_token_hash_idx").on(table.tokenHash),
    index("sessions_is_revoked_idx").on(table.isRevoked),
    index("sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  id: true,
  createdAt: true,
  lastActiveAt: true,
});

export const selectSessionSchema = createSelectSchema(sessionsTable);

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessionsTable.$inferSelect;
