import type { Request, Response, NextFunction } from "express";
import { findOrganizationById, findOrganizationBySlug, findMembership } from "../services/auth-db";
import { getUserEffectivePermissions, getUserRoleNames } from "../services/rbac-service";
import type { TenantContext } from "../services/auth-types";

/**
 * tenant-middleware.ts — Organization context resolution and injection.
 *
 * Reads X-Organization-Id or X-Organization-Slug header and validates
 * that the authenticated user is a member of that organization.
 * Attaches req.tenant with the resolved org context and org-scoped permissions.
 *
 * Non-blocking — if no org header is present, req.tenant is undefined.
 * Routes that require an org context should call requireTenant().
 */

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) return next();

  const orgId = req.headers["x-organization-id"] as string | undefined;
  const orgSlug = req.headers["x-organization-slug"] as string | undefined;

  if (!orgId && !orgSlug) return next();

  try {
    const org = orgId
      ? await findOrganizationById(orgId)
      : await findOrganizationBySlug(orgSlug!);

    if (!org || !org.isActive) return next();

    // Super admins bypass membership check
    const isSuperAdmin = req.auth.isSuperAdmin;
    if (!isSuperAdmin) {
      const membership = await findMembership(req.auth.userId, org.id);
      if (!membership || !membership.isActive) return next();
    }

    // Get org-scoped permissions
    const permissions = await getUserEffectivePermissions(req.auth.userId, org.id);
    const membershipRow = isSuperAdmin ? null : await findMembership(req.auth.userId, org.id);

    req.tenant = {
      organizationId: org.id,
      organizationSlug: org.slug,
      memberRole: membershipRow?.orgRole ?? (isSuperAdmin ? "super_admin" : "member"),
      permissions: permissions as any,
    };

    // Update auth context with org-scoped permissions
    if (req.auth) {
      req.auth.organizationId = org.id;
      req.auth.permissions = permissions;
    }
  } catch {
    // Non-fatal — just don't set tenant context
  }

  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.tenant) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "Organization context required. Set X-Organization-Id or X-Organization-Slug header." } });
    return;
  }
  next();
}
