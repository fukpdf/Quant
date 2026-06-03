import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Users — platform accounts.
 * Passwords are hashed with Argon2id; raw passwords never stored.
 * Supports email verification, password reset, and account lockout.
 */
export const usersTable = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerificationToken: varchar("email_verification_token", { length: 255 }),
    emailVerificationExpiresAt: timestamp("email_verification_expires_at", { withTimezone: true }),
    passwordHash: text("password_hash").notNull(),
    firstName: varchar("first_name", { length: 100 }),
    lastName: varchar("last_name", { length: 100 }),
    avatarUrl: text("avatar_url"),
    isActive: boolean("is_active").notNull().default(true),
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull().defaultNow(),
    passwordResetToken: varchar("password_reset_token", { length: 255 }),
    passwordResetExpiresAt: timestamp("password_reset_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_is_active_idx").on(table.isActive),
    index("users_email_verification_token_idx").on(table.emailVerificationToken),
    index("users_password_reset_token_idx").on(table.passwordResetToken),
  ],
);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  passwordChangedAt: true,
});

export const selectUserSchema = createSelectSchema(usersTable);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
