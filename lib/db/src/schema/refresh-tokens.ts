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
import { sessionsTable } from "./sessions";

/**
 * Refresh tokens — long-lived tokens for access token rotation.
 * Stored as SHA-256 hashes. Token families enable rotation attack detection:
 * if a revoked token is reused, all tokens in its family are revoked (family revocation).
 */
export const refreshTokensTable = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull().references(() => sessionsTable.id, { onDelete: "cascade" }),
    /** SHA-256 hash of the opaque refresh token value */
    tokenHash: text("token_hash").notNull(),
    /** Token family ID — all rotations of the same original token share a family */
    family: uuid("family").notNull().defaultRandom(),
    isRevoked: boolean("is_revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    /** ID of the token that was issued in place of this one during rotation */
    replacedByTokenId: uuid("replaced_by_token_id"),
    ipAddress: varchar("ip_address", { length: 45 }),
    deviceInfo: jsonb("device_info"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("refresh_tokens_user_id_idx").on(table.userId),
    index("refresh_tokens_token_hash_idx").on(table.tokenHash),
    index("refresh_tokens_family_idx").on(table.family),
    index("refresh_tokens_session_id_idx").on(table.sessionId),
    index("refresh_tokens_is_revoked_idx").on(table.isRevoked),
  ],
);

export const insertRefreshTokenSchema = createInsertSchema(refreshTokensTable).omit({
  id: true,
  createdAt: true,
});

export const selectRefreshTokenSchema = createSelectSchema(refreshTokensTable);

export type InsertRefreshToken = z.infer<typeof insertRefreshTokenSchema>;
export type RefreshToken = typeof refreshTokensTable.$inferSelect;
