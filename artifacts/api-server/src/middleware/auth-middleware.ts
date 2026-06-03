import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../services/token-service";
import { validateSession } from "../services/session-service";
import { validateApiKey } from "../services/api-key-service";
import { findUserById } from "../services/auth-db";
import { getUserEffectivePermissions, getUserRoleNames } from "../services/rbac-service";
import type { AuthContext } from "../services/auth-types";

/**
 * auth-middleware.ts — JWT access token + session validation.
 *
 * Supports two auth mechanisms:
 *   1. Bearer token in Authorization header (JWT access token)
 *   2. X-Api-Key header (API key for programmatic access)
 *
 * On success, attaches req.auth with the validated auth context.
 * On failure, passes through (use requireAuth() to enforce authentication).
 */

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Middleware: attempts to resolve auth context from Bearer token or API key.
 * Non-blocking — continues even if no credentials provided.
 * Routes that require auth should also use requireAuth().
 */
export async function resolveAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  // 1. Try Bearer token
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      // Validate the backing session is still active
      const session = await validateSession(payload.sessionId).catch(() => null);
      if (session) {
        req.auth = {
          userId: payload.sub,
          email: payload.email,
          sessionId: payload.sessionId,
          organizationId: payload.orgId,
          roles: payload.roles,
          permissions: payload.permissions,
          isSuperAdmin: payload.isSuperAdmin,
        };
        return next();
      }
    }
    // Invalid token — don't 401 here; requireAuth() will handle it
    return next();
  }

  // 2. Try X-Api-Key header
  const apiKeyHeader = req.headers["x-api-key"];
  if (typeof apiKeyHeader === "string" && apiKeyHeader.startsWith("qf_")) {
    const keyRecord = await validateApiKey(apiKeyHeader).catch(() => null);
    if (keyRecord) {
      const user = await findUserById(keyRecord.userId).catch(() => null);
      if (user && user.isActive) {
        const permissions = (keyRecord.permissions as string[]) ?? [];
        req.auth = {
          userId: user.id,
          email: user.email,
          sessionId: `apikey:${keyRecord.id}`,
          organizationId: keyRecord.organizationId ?? null,
          roles: [],
          permissions,
          isSuperAdmin: user.isSuperAdmin,
        };
        return next();
      }
    }
    return next();
  }

  next();
}

/**
 * Middleware factory: require authentication.
 * Returns 401 if no valid auth context is attached by resolveAuth().
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    return;
  }
  next();
}

/**
 * Convenience: resolveAuth + requireAuth in sequence.
 * Use as route middleware: router.get("/resource", ...authenticated(), handler)
 */
export function authenticated() {
  return [resolveAuth, requireAuth] as const;
}
