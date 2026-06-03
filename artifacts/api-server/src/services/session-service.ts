import crypto from "crypto";
import {
  createSession, findSessionById, findActiveSessionsByUser,
  updateSessionLastActive, revokeSession, revokeAllUserSessions,
  createRefreshToken, findRefreshTokenByHash, revokeRefreshToken, revokeRefreshTokenFamily,
} from "./auth-db";
import { generateRefreshToken, hashRefreshToken, refreshTokenTtl } from "./token-service";
import type { Session, RefreshToken } from "@workspace/db";

/**
 * session-service.ts — Server-side session and refresh token lifecycle management.
 *
 * Sessions provide server-side revocability on top of JWT tokens.
 * Refresh tokens use rotation with family-based theft detection.
 */

// ---------------------------------------------------------------------------
// Session creation
// ---------------------------------------------------------------------------

export async function createAuthSession(opts: {
  userId: string;
  tokenHash: string;
  deviceInfo?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  rememberMe?: boolean;
}): Promise<{ session: Session; refreshToken: { raw: string; record: RefreshToken } }> {
  const ttlMs = refreshTokenTtl(opts.rememberMe ?? false);
  const expiresAt = new Date(Date.now() + ttlMs * 1000);

  const session = await createSession({
    userId: opts.userId,
    tokenHash: opts.tokenHash,
    deviceInfo: opts.deviceInfo ?? null,
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ?? null,
    expiresAt,
    isRevoked: false,
  });

  const rt = generateRefreshToken();
  const family = crypto.randomUUID();

  const refreshRecord = await createRefreshToken({
    userId: opts.userId,
    sessionId: session.id,
    tokenHash: rt.hash,
    family,
    isRevoked: false,
    ipAddress: opts.ipAddress ?? null,
    deviceInfo: opts.deviceInfo ?? null,
    expiresAt,
  });

  return { session, refreshToken: { raw: rt.raw, record: refreshRecord } };
}

// ---------------------------------------------------------------------------
// Token rotation
// ---------------------------------------------------------------------------

/**
 * Rotate a refresh token. If the token has already been used (reuse attack),
 * revoke the entire family (boot all sessions derived from this token line).
 */
export async function rotateRefreshToken(opts: {
  rawToken: string;
  userId: string;
  ipAddress?: string | null;
  newTokenHash: string;
}): Promise<{ newRefreshRaw: string; newRefreshRecord: RefreshToken } | null> {
  const hash = hashRefreshToken(opts.rawToken);
  const existing = await findRefreshTokenByHash(hash);

  if (!existing) return null;
  if (existing.userId !== opts.userId) return null;
  if (existing.expiresAt < new Date()) return null;

  if (existing.isRevoked) {
    // Reuse of a revoked token — revoke the entire family (theft detection)
    await revokeRefreshTokenFamily(existing.family);
    return null;
  }

  const newRt = generateRefreshToken();
  const newRecord = await createRefreshToken({
    userId: existing.userId,
    sessionId: existing.sessionId,
    tokenHash: newRt.hash,
    family: existing.family,
    isRevoked: false,
    ipAddress: opts.ipAddress ?? null,
    deviceInfo: existing.deviceInfo as Record<string, unknown> | null,
    expiresAt: existing.expiresAt,
  });

  await revokeRefreshToken(existing.id, newRecord.id);

  return { newRefreshRaw: newRt.raw, newRefreshRecord: newRecord };
}

// ---------------------------------------------------------------------------
// Session validation and revocation
// ---------------------------------------------------------------------------

export async function validateSession(sessionId: string): Promise<Session | null> {
  const session = await findSessionById(sessionId);
  if (!session) return null;
  if (session.isRevoked) return null;
  if (session.expiresAt < new Date()) return null;
  return session;
}

export async function revokeUserSession(sessionId: string, reason?: string): Promise<void> {
  await revokeSession(sessionId, reason);
}

export async function revokeAllSessions(userId: string, reason?: string): Promise<void> {
  await revokeAllUserSessions(userId, reason);
}

export async function listActiveSessions(userId: string): Promise<Session[]> {
  return findActiveSessionsByUser(userId);
}

export async function touchSession(sessionId: string, newTokenHash: string): Promise<void> {
  await updateSessionLastActive(sessionId, newTokenHash);
}
