/**
 * auth-types.ts — Shared TypeScript types for the Phase 14 auth subsystem.
 *
 * All imports in this file are at the top (esbuild top-level import rule).
 */

// ---------------------------------------------------------------------------
// Token payloads
// ---------------------------------------------------------------------------

export interface AccessTokenPayload {
  sub: string;        // userId
  email: string;
  sessionId: string;
  orgId: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenData {
  raw: string;        // the opaque token value (sent to client)
  hash: string;       // SHA-256 hash stored in DB
  family: string;     // rotation family ID
}

// ---------------------------------------------------------------------------
// Auth context (attached to req by middleware)
// ---------------------------------------------------------------------------

export interface AuthContext {
  userId: string;
  email: string;
  sessionId: string;
  organizationId: string | null;
  roles: string[];
  permissions: string[];
  isSuperAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Auth service I/O types
// ---------------------------------------------------------------------------

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  rememberMe?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;      // access token TTL in seconds
  tokenType: "Bearer";
}

export interface AuthResult {
  tokens: AuthTokens;
  user: SafeUser;
}

export interface SafeUser {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// RBAC types
// ---------------------------------------------------------------------------

export type PermissionName =
  | "portfolio:read"   | "portfolio:write"   | "portfolio:delete"   | "portfolio:admin"
  | "research:read"    | "research:write"     | "research:delete"    | "research:admin"
  | "risk:read"        | "risk:write"         | "risk:delete"        | "risk:admin"
  | "execution:read"   | "execution:write"    | "execution:delete"   | "execution:admin"
  | "ai:read"          | "ai:write"
  | "operations:read"  | "operations:write"   | "operations:admin"
  | "users:read"       | "users:write"        | "users:delete"       | "users:admin"
  | "billing:read"     | "billing:admin"
  | "streams:read"
  | "intelligence:read"| "intelligence:write";

export type RoleName =
  | "super_admin"
  | "org_owner"
  | "admin"
  | "portfolio_manager"
  | "trader"
  | "analyst"
  | "viewer";

export const ROLE_PERMISSION_MATRIX: Record<RoleName, PermissionName[]> = {
  super_admin: [
    "portfolio:read", "portfolio:write", "portfolio:delete", "portfolio:admin",
    "research:read", "research:write", "research:delete", "research:admin",
    "risk:read", "risk:write", "risk:delete", "risk:admin",
    "execution:read", "execution:write", "execution:delete", "execution:admin",
    "ai:read", "ai:write",
    "operations:read", "operations:write", "operations:admin",
    "users:read", "users:write", "users:delete", "users:admin",
    "billing:read", "billing:admin",
    "streams:read",
    "intelligence:read", "intelligence:write",
  ],
  org_owner: [
    "portfolio:read", "portfolio:write", "portfolio:delete", "portfolio:admin",
    "research:read", "research:write", "research:delete", "research:admin",
    "risk:read", "risk:write", "risk:delete", "risk:admin",
    "execution:read", "execution:write", "execution:delete", "execution:admin",
    "ai:read", "ai:write",
    "operations:read", "operations:write", "operations:admin",
    "users:read", "users:write", "users:delete",
    "billing:read", "billing:admin",
    "streams:read",
    "intelligence:read", "intelligence:write",
  ],
  admin: [
    "portfolio:read", "portfolio:write", "portfolio:delete",
    "research:read", "research:write", "research:delete",
    "risk:read", "risk:write",
    "execution:read", "execution:write",
    "ai:read", "ai:write",
    "operations:read", "operations:write",
    "users:read", "users:write",
    "billing:read",
    "streams:read",
    "intelligence:read", "intelligence:write",
  ],
  portfolio_manager: [
    "portfolio:read", "portfolio:write", "portfolio:delete", "portfolio:admin",
    "research:read", "research:write", "research:delete",
    "risk:read",
    "execution:read",
    "ai:read", "ai:write",
    "operations:read",
    "streams:read",
    "intelligence:read", "intelligence:write",
  ],
  trader: [
    "portfolio:read",
    "research:read",
    "risk:read",
    "execution:read", "execution:write",
    "ai:read",
    "streams:read",
    "intelligence:read",
  ],
  analyst: [
    "portfolio:read",
    "research:read", "research:write",
    "risk:read",
    "ai:read", "ai:write",
    "streams:read",
    "intelligence:read", "intelligence:write",
  ],
  viewer: [
    "portfolio:read",
    "research:read",
    "risk:read",
    "execution:read",
    "ai:read",
    "operations:read",
    "streams:read",
    "intelligence:read",
  ],
};

// ---------------------------------------------------------------------------
// Tenant context
// ---------------------------------------------------------------------------

export interface TenantContext {
  organizationId: string;
  organizationSlug: string;
  memberRole: string;
  permissions: PermissionName[];
}

// ---------------------------------------------------------------------------
// Email provider types
// ---------------------------------------------------------------------------

export interface EmailMessage {
  to: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
}

export interface IEmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

// ---------------------------------------------------------------------------
// Security event tracking
// ---------------------------------------------------------------------------

export type SecurityEventType =
  | "login_success"
  | "login_failure"
  | "logout"
  | "password_change"
  | "password_reset_request"
  | "password_reset_complete"
  | "email_verified"
  | "account_locked"
  | "account_unlocked"
  | "session_revoked"
  | "token_revoked"
  | "api_key_created"
  | "api_key_revoked"
  | "role_assigned"
  | "role_revoked"
  | "permission_denied"
  | "suspicious_activity"
  | "brute_force_detected"
  | "invitation_sent"
  | "invitation_accepted"
  | "invitation_declined";

export type SecuritySeverity = "info" | "warning" | "critical";

export interface SecurityEventInput {
  userId?: string | null;
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown>;
  organizationId?: string | null;
}
