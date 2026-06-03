import type { Request, Response, NextFunction } from "express";
import { hasPermission, hasAnyPermission, hasAllPermissions } from "../services/rbac-service";
import type { PermissionName } from "../services/auth-types";

/**
 * rbac-middleware.ts — Permission-based access control middleware factories.
 *
 * All factories require that resolveAuth + requireAuth have already run.
 * Super admins bypass all permission checks.
 */

/**
 * Require a single permission.
 */
export function requirePermission(permission: PermissionName) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
      return;
    }
    if (!hasPermission(auth.permissions, permission, auth.isSuperAdmin)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: `Permission required: ${permission}` } });
      return;
    }
    next();
  };
}

/**
 * Require ANY of the listed permissions (OR logic).
 */
export function requireAnyPermission(permissions: PermissionName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
      return;
    }
    if (!hasAnyPermission(auth.permissions, permissions, auth.isSuperAdmin)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: `One of these permissions required: ${permissions.join(", ")}` } });
      return;
    }
    next();
  };
}

/**
 * Require ALL of the listed permissions (AND logic).
 */
export function requireAllPermissions(permissions: PermissionName[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
      return;
    }
    if (!hasAllPermissions(auth.permissions, permissions, auth.isSuperAdmin)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: `All of these permissions required: ${permissions.join(", ")}` } });
      return;
    }
    next();
  };
}

/**
 * Require super admin role.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth?.isSuperAdmin) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Super admin access required." } });
    return;
  }
  next();
}

/**
 * Require that the requesting user IS the target user, or is a super admin / users:admin holder.
 * Reads the :userId param from the route.
 */
export function requireSelfOrAdmin(req: Request, res: Response, next: NextFunction): void {
  const auth = req.auth;
  if (!auth) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
    return;
  }
  const targetUserId = req.params["userId"] ?? req.params["id"];
  if (auth.userId === targetUserId || auth.isSuperAdmin || auth.permissions.includes("users:admin")) {
    return next();
  }
  res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied." } });
}
