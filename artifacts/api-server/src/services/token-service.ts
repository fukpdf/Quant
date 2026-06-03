import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { AccessTokenPayload } from "./auth-types";

/**
 * token-service.ts — JWT access token and opaque refresh token management.
 *
 * Access tokens: signed JWT, 15-minute TTL (or 1-day for remember-me sessions).
 * Refresh tokens: cryptographically random opaque values, stored as SHA-256 hashes.
 */

const JWT_SECRET = process.env["JWT_SECRET"] ?? process.env["SESSION_SECRET"] ?? "dev-jwt-secret-change-in-production";
const ACCESS_TOKEN_TTL = 15 * 60;              // 15 minutes in seconds
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;   // 7 days
const REFRESH_TOKEN_TTL_LONG = 30 * 24 * 60 * 60; // 30 days (remember me)

// ---------------------------------------------------------------------------
// Access Tokens (JWT)
// ---------------------------------------------------------------------------

/**
 * Generate a signed JWT access token.
 */
export function generateAccessToken(payload: Omit<AccessTokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    issuer: "quantforge",
    audience: "quantforge-api",
  });
}

/**
 * Verify and decode a JWT access token.
 * Returns null if expired, malformed, or signature invalid.
 */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: "quantforge",
      audience: "quantforge-api",
    });
    return decoded as AccessTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Decode without verifying (used for logging/audit — never for auth decisions).
 */
export function decodeTokenUnsafe(token: string): AccessTokenPayload | null {
  try {
    return jwt.decode(token) as AccessTokenPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Refresh Tokens (opaque)
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically random refresh token.
 * Returns both the raw value (sent to client) and the SHA-256 hash (stored in DB).
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(40).toString("hex");
  const hash = sha256(raw);
  return { raw, hash };
}

/**
 * Hash a raw refresh token for DB storage or lookup.
 */
export function hashRefreshToken(raw: string): string {
  return sha256(raw);
}

/**
 * Get the TTL in seconds for a refresh token based on remember-me.
 */
export function refreshTokenTtl(rememberMe: boolean): number {
  return rememberMe ? REFRESH_TOKEN_TTL_LONG : REFRESH_TOKEN_TTL;
}

/**
 * Get the access token TTL in seconds.
 */
export function accessTokenTtl(): number {
  return ACCESS_TOKEN_TTL;
}

// ---------------------------------------------------------------------------
// Email / password reset tokens
// ---------------------------------------------------------------------------

/**
 * Generate a secure random token for email verification or password reset.
 * Returns a URL-safe hex string.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token for DB lookup (prevents exposure if DB is compromised).
 */
export function hashToken(raw: string): string {
  return sha256(raw);
}

// ---------------------------------------------------------------------------
// API key generation
// ---------------------------------------------------------------------------

/**
 * Generate a new API key with prefix "qf_".
 * Format: qf_<64 hex chars>
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const random = crypto.randomBytes(32).toString("hex");
  const raw = `qf_${random}`;
  const hash = sha256(raw);
  const prefix = raw.substring(3, 11); // 8 chars after "qf_"
  return { raw, hash, prefix };
}

/**
 * Hash an API key for DB storage or lookup.
 */
export function hashApiKey(raw: string): string {
  return sha256(raw);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
