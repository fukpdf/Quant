import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { organizationsTable } from "./organizations";

/**
 * API keys — long-lived credentials for programmatic access.
 * Raw key format: qf_<32 random bytes hex>
 * Stored as SHA-256 hash; prefix (first 8 chars after "qf_") stored for display.
 * Permissions are a subset of the user's permissions at time of creation.
 */
export const apiKeysTable = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id").references(() => organizationsTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    /** SHA-256 hash of the raw API key */
    keyHash: text("key_hash").notNull(),
    /** First 8 chars of the raw key (after prefix) — for display only */
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    /** Array of permission strings granted to this key */
    permissions: jsonb("permissions").notNull().default([]),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    isRevoked: boolean("is_revoked").notNull().default(false),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("api_keys_key_hash_idx").on(table.keyHash),
    index("api_keys_user_id_idx").on(table.userId),
    index("api_keys_org_id_idx").on(table.organizationId),
    index("api_keys_is_revoked_idx").on(table.isRevoked),
  ],
);

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectApiKeySchema = createSelectSchema(apiKeysTable);

export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKey = typeof apiKeysTable.$inferSelect;
