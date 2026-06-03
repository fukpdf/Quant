import crypto from "crypto";
import {
  findUserByEmail, findUserById, createUser, updateUser,
  findUserByVerificationToken, findUserByPasswordResetToken,
  incrementFailedLoginAttempts, resetFailedLoginAttempts,
  createOrganization, createMembership, upsertUserPreferences, upsertUserSettings,
} from "./auth-db";
import { hashPassword, verifyPassword, needsRehash } from "./password-service";
import { generateAccessToken, generateSecureToken, hashToken, accessTokenTtl } from "./token-service";
import { createAuthSession, rotateRefreshToken, validateSession, revokeUserSession, revokeAllSessions, touchSession } from "./session-service";
import { recordSecurityEvent, checkAndApplyBruteForceProtection, isAccountLocked } from "./security-event-service";
import { auditUserLogin, auditUserLogout, auditUserRegister, auditPasswordChange, auditPasswordReset } from "./auth-audit-service";
import { assignRole } from "./rbac-service";
import { getEmailProvider, buildVerificationEmail, buildPasswordResetEmail } from "./email-provider";
import { getUserEffectivePermissions, getUserRoleNames } from "./rbac-service";
import { logger } from "../lib/logger";
import type { RegisterInput, LoginInput, AuthResult, AuthTokens, SafeUser } from "./auth-types";
import type { User } from "@workspace/db";
import crypto_module from "crypto";

/**
 * auth-service.ts — Core authentication flows.
 * Orchestrates: registration, login, logout, refresh, verification, password reset.
 */

// ---------------------------------------------------------------------------
// Token hash helper (for session tokenHash field)
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto_module.createHash("sha256").update(input).digest("hex");
}

// ---------------------------------------------------------------------------
// Safe user projection (never expose passwordHash)
// ---------------------------------------------------------------------------

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: user.avatarUrl ?? null,
    isActive: user.isActive,
    isSuperAdmin: user.isSuperAdmin,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Token generation helper
// ---------------------------------------------------------------------------

async function buildTokens(user: User, sessionId: string, orgId: string | null): Promise<AuthTokens & { accessTokenHash: string }> {
  const permissions = await getUserEffectivePermissions(user.id, orgId);
  const roles = await getUserRoleNames(user.id, orgId);

  const accessToken = generateAccessToken({
    sub: user.id,
    email: user.email,
    sessionId,
    orgId,
    roles,
    permissions,
    isSuperAdmin: user.isSuperAdmin,
  });

  return {
    accessToken,
    refreshToken: "", // filled by caller
    expiresIn: accessTokenTtl(),
    tokenType: "Bearer",
    accessTokenHash: sha256(accessToken),
  };
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export async function register(input: RegisterInput, ipAddress?: string, userAgent?: string): Promise<AuthResult> {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw Object.assign(new Error("Email already registered"), { code: "EMAIL_TAKEN" });
  }

  const passwordHash = await hashPassword(input.password);
  const verificationToken = generateSecureToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const user = await createUser({
    email: input.email.toLowerCase(),
    passwordHash,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    emailVerificationToken: verificationToken,
    emailVerificationExpiresAt: verificationExpires,
    emailVerified: false,
    isActive: true,
    isSuperAdmin: false,
  });

  // Seed default preferences and settings
  await upsertUserPreferences(user.id, {});
  await upsertUserSettings(user.id, {});

  // Create a personal organization for the user
  const orgName = input.organizationName ?? `${input.firstName ?? input.email.split("@")[0]}'s Organization`;
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").substring(0, 50)
    + "-" + Math.random().toString(36).substring(2, 7);
  const org = await createOrganization({ name: orgName, slug, createdBy: user.id, isActive: true, maxMembers: 5, plan: "free" });
  await createMembership({ userId: user.id, organizationId: org.id, orgRole: "owner", isActive: true, invitedBy: null });

  // Assign org_owner role in org context
  await assignRole({ userId: user.id, roleName: "org_owner", organizationId: org.id });

  // Build tokens
  const permissions = await getUserEffectivePermissions(user.id, org.id);
  const roles = await getUserRoleNames(user.id, org.id);
  const accessToken = generateAccessToken({
    sub: user.id, email: user.email, sessionId: "pending",
    orgId: org.id, roles, permissions, isSuperAdmin: user.isSuperAdmin,
  });

  const { session, refreshToken } = await createAuthSession({
    userId: user.id,
    tokenHash: sha256(accessToken),
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
    rememberMe: false,
    deviceInfo: null,
  });

  // Re-issue access token with real session ID
  const finalAccessToken = generateAccessToken({
    sub: user.id, email: user.email, sessionId: session.id,
    orgId: org.id, roles, permissions, isSuperAdmin: user.isSuperAdmin,
  });
  await touchSession(session.id, sha256(finalAccessToken));

  // Send verification email (non-fatal)
  try {
    const emailProvider = getEmailProvider();
    const msg = buildVerificationEmail(user.email, verificationToken);
    await emailProvider.send(msg);
  } catch (err) {
    logger.error({ err, userId: user.id }, "Failed to send verification email");
  }

  await auditUserRegister({ actorId: user.id, actorEmail: user.email, ipAddress: ipAddress ?? null });
  await recordSecurityEvent({ userId: user.id, eventType: "login_success", severity: "info", ipAddress, userAgent });

  return {
    tokens: { accessToken: finalAccessToken, refreshToken: refreshToken.raw, expiresIn: accessTokenTtl(), tokenType: "Bearer" },
    user: toSafeUser(user),
  };
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function login(input: LoginInput): Promise<AuthResult & { organizationId: string | null }> {
  const user = await findUserByEmail(input.email);

  if (!user) {
    // Record failed login without userId (user not found — still log)
    await recordSecurityEvent({
      eventType: "login_failure", severity: "warning",
      ipAddress: input.ipAddress, userAgent: input.userAgent,
      details: { email: input.email.toLowerCase(), reason: "user_not_found" },
    });
    throw Object.assign(new Error("Invalid email or password"), { code: "INVALID_CREDENTIALS" });
  }

  // Check account lockout
  const lockUntil = isAccountLocked(user.lockedUntil);
  if (lockUntil) {
    await recordSecurityEvent({
      userId: user.id, eventType: "login_failure", severity: "warning",
      ipAddress: input.ipAddress, userAgent: input.userAgent,
      details: { reason: "account_locked", lockedUntil: lockUntil.toISOString() },
    });
    throw Object.assign(new Error(`Account is locked until ${lockUntil.toISOString()}`), { code: "ACCOUNT_LOCKED" });
  }

  const valid = await verifyPassword(user.passwordHash, input.password);

  if (!valid) {
    await incrementFailedLoginAttempts(user.id);
    await recordSecurityEvent({
      userId: user.id, eventType: "login_failure", severity: "warning",
      ipAddress: input.ipAddress, userAgent: input.userAgent,
      details: { email: user.email, reason: "wrong_password" },
    });
    await checkAndApplyBruteForceProtection(user.id, user.email);
    throw Object.assign(new Error("Invalid email or password"), { code: "INVALID_CREDENTIALS" });
  }

  if (!user.isActive) {
    throw Object.assign(new Error("Account is deactivated"), { code: "ACCOUNT_INACTIVE" });
  }

  // Rehash if needed (Argon2 params changed)
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(input.password);
    await updateUser(user.id, { passwordHash: newHash });
  }

  await resetFailedLoginAttempts(user.id);
  await updateUser(user.id, { lastLoginAt: new Date() });

  // Get default org context (first active membership)
  const { db, membershipsTable } = await import("@workspace/db");
  const { eq, and: andOp } = await import("drizzle-orm");
  const memberships = await db.select().from(membershipsTable)
    .where(andOp(eq(membershipsTable.userId, user.id), eq(membershipsTable.isActive, true)))
    .limit(1);
  const orgId = memberships[0]?.organizationId ?? null;

  const permissions = await getUserEffectivePermissions(user.id, orgId);
  const roles = await getUserRoleNames(user.id, orgId);

  // Create session placeholder
  const tmpToken = generateAccessToken({ sub: user.id, email: user.email, sessionId: "pending", orgId, roles, permissions, isSuperAdmin: user.isSuperAdmin });
  const { session, refreshToken } = await createAuthSession({
    userId: user.id,
    tokenHash: sha256(tmpToken),
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    rememberMe: input.rememberMe ?? false,
    deviceInfo: null,
  });

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, sessionId: session.id, orgId, roles, permissions, isSuperAdmin: user.isSuperAdmin });
  await touchSession(session.id, sha256(accessToken));

  await auditUserLogin({ actorId: user.id, actorEmail: user.email, ipAddress: input.ipAddress, userAgent: input.userAgent });
  await recordSecurityEvent({ userId: user.id, eventType: "login_success", severity: "info", ipAddress: input.ipAddress, userAgent: input.userAgent });

  return {
    tokens: { accessToken, refreshToken: refreshToken.raw, expiresIn: accessTokenTtl(), tokenType: "Bearer" },
    user: toSafeUser(user),
    organizationId: orgId,
  };
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

export async function logout(sessionId: string, userId: string, email: string, ipAddress?: string): Promise<void> {
  await revokeUserSession(sessionId, "explicit_logout");
  await auditUserLogout({ actorId: userId, actorEmail: email, sessionId, ipAddress: ipAddress ?? null });
  await recordSecurityEvent({ userId, eventType: "logout", severity: "info", ipAddress });
}

// ---------------------------------------------------------------------------
// Refresh
// ---------------------------------------------------------------------------

export async function refreshTokens(rawRefreshToken: string, ipAddress?: string): Promise<AuthTokens | null> {
  const { hashRefreshToken: hashRt } = await import("./token-service");
  const hash = hashRt(rawRefreshToken);
  const { findRefreshTokenByHash: findRT } = await import("./auth-db");
  const rtRecord = await findRT(hash);
  if (!rtRecord || rtRecord.isRevoked || rtRecord.expiresAt < new Date()) return null;

  const user = await findUserById(rtRecord.userId);
  if (!user || !user.isActive) return null;

  const session = await validateSession(rtRecord.sessionId);
  if (!session) return null;

  const newRtData = await rotateRefreshToken({ rawToken: rawRefreshToken, userId: user.id, ipAddress: ipAddress ?? null, newTokenHash: "" });
  if (!newRtData) return null;

  const orgId = null; // use null org (caller can override via header)
  const permissions = await getUserEffectivePermissions(user.id, orgId);
  const roles = await getUserRoleNames(user.id, orgId);
  const accessToken = generateAccessToken({ sub: user.id, email: user.email, sessionId: session.id, orgId, roles, permissions, isSuperAdmin: user.isSuperAdmin });
  await touchSession(session.id, sha256(accessToken));

  return { accessToken, refreshToken: newRtData.newRefreshRaw, expiresIn: accessTokenTtl(), tokenType: "Bearer" };
}

// ---------------------------------------------------------------------------
// Email verification
// ---------------------------------------------------------------------------

export async function verifyEmail(token: string): Promise<boolean> {
  const user = await findUserByVerificationToken(token);
  if (!user) return false;
  if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) return false;
  await updateUser(user.id, { emailVerified: true, emailVerificationToken: null, emailVerificationExpiresAt: null });
  await recordSecurityEvent({ userId: user.id, eventType: "email_verified", severity: "info" });
  return true;
}

export async function resendVerificationEmail(userId: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user || user.emailVerified) return;
  const token = generateSecureToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await updateUser(user.id, { emailVerificationToken: token, emailVerificationExpiresAt: expires });
  const msg = buildVerificationEmail(user.email, token);
  await getEmailProvider().send(msg);
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function forgotPassword(email: string, ipAddress?: string): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user) return; // Silently succeed — don't leak whether email exists
  const token = generateSecureToken();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await updateUser(user.id, { passwordResetToken: token, passwordResetExpiresAt: expires });
  const msg = buildPasswordResetEmail(user.email, token);
  await getEmailProvider().send(msg);
  await recordSecurityEvent({ userId: user.id, eventType: "password_reset_request", severity: "info", ipAddress });
}

export async function resetPassword(token: string, newPassword: string, ipAddress?: string): Promise<boolean> {
  const user = await findUserByPasswordResetToken(token);
  if (!user) return false;
  const newHash = await hashPassword(newPassword);
  await updateUser(user.id, {
    passwordHash: newHash,
    passwordResetToken: null,
    passwordResetExpiresAt: null,
    passwordChangedAt: new Date(),
    failedLoginAttempts: 0,
    lockedUntil: null,
  });
  await revokeAllSessions(user.id, "password_reset");
  await auditPasswordReset({ email: user.email, ipAddress: ipAddress ?? null });
  await recordSecurityEvent({ userId: user.id, eventType: "password_reset_complete", severity: "info", ipAddress });
  return true;
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string, ipAddress?: string): Promise<void> {
  const user = await findUserById(userId);
  if (!user) throw new Error("User not found");
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw Object.assign(new Error("Current password is incorrect"), { code: "INVALID_CREDENTIALS" });
  const newHash = await hashPassword(newPassword);
  await updateUser(userId, { passwordHash: newHash, passwordChangedAt: new Date() });
  await auditPasswordChange({ actorId: userId, actorEmail: user.email, ipAddress: ipAddress ?? null });
  await recordSecurityEvent({ userId, eventType: "password_change", severity: "info", ipAddress });
}

// ---------------------------------------------------------------------------
// Super-admin bootstrap
// ---------------------------------------------------------------------------

/**
 * Ensure at least one super admin exists.
 * If no super admin is found, the first registered user will be promoted automatically.
 * This function is called on server startup.
 */
export async function ensureSuperAdminExists(): Promise<void> {
  const { db, usersTable } = await import("@workspace/db");
  const { eq: eqOp, sql: sqlOp } = await import("drizzle-orm");
  const [superAdminRow] = await db.select({ count: sqlOp<number>`count(*)` })
    .from(usersTable)
    .where(eqOp(usersTable.isSuperAdmin, true));
  if (Number(superAdminRow?.count ?? 0) > 0) return;

  // Promote first user to super admin
  const firstUser = await db.select().from(usersTable).orderBy(usersTable.createdAt).limit(1);
  if (firstUser[0]) {
    await updateUser(firstUser[0].id, { isSuperAdmin: true });
    await assignRole({ userId: firstUser[0].id, roleName: "super_admin", organizationId: null });
    logger.info({ userId: firstUser[0].id, email: firstUser[0].email }, "Promoted first user to super admin");
  }
}
