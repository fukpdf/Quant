import {
  listRoles, findRoleByName, findRoleById, upsertRole,
  listPermissions, findPermissionByName, upsertPermission,
  setRolePermissions, getPermissionsForRole,
  assignUserRole, listUserRoles, removeUserRole, getEffectivePermissionsForUser,
} from "./auth-db";
import { ROLE_PERMISSION_MATRIX, type RoleName, type PermissionName } from "./auth-types";
import { logger } from "../lib/logger";
import type { Role, Permission, UserRole } from "@workspace/db";

/**
 * rbac-service.ts — Role-Based Access Control.
 *
 * Provides:
 *   - Seeding of built-in roles and permissions on startup
 *   - Permission checks for request handlers
 *   - Role assignment and revocation
 */

// ---------------------------------------------------------------------------
// Seeding — called on server startup
// ---------------------------------------------------------------------------

const SYSTEM_PERMISSIONS: Array<{ name: PermissionName; resource: string; action: string; description: string }> = [
  { name: "portfolio:read",    resource: "portfolio",   action: "read",   description: "View portfolio data" },
  { name: "portfolio:write",   resource: "portfolio",   action: "write",  description: "Modify portfolio data" },
  { name: "portfolio:delete",  resource: "portfolio",   action: "delete", description: "Delete portfolio entities" },
  { name: "portfolio:admin",   resource: "portfolio",   action: "admin",  description: "Full portfolio administration" },
  { name: "research:read",     resource: "research",    action: "read",   description: "View research and backtests" },
  { name: "research:write",    resource: "research",    action: "write",  description: "Run backtests and create research" },
  { name: "research:delete",   resource: "research",    action: "delete", description: "Delete research runs" },
  { name: "research:admin",    resource: "research",    action: "admin",  description: "Full research administration" },
  { name: "risk:read",         resource: "risk",        action: "read",   description: "View risk data and profiles" },
  { name: "risk:write",        resource: "risk",        action: "write",  description: "Modify risk profiles and rules" },
  { name: "risk:delete",       resource: "risk",        action: "delete", description: "Delete risk entities" },
  { name: "risk:admin",        resource: "risk",        action: "admin",  description: "Full risk engine administration" },
  { name: "execution:read",    resource: "execution",   action: "read",   description: "View orders and fills" },
  { name: "execution:write",   resource: "execution",   action: "write",  description: "Submit and cancel orders" },
  { name: "execution:delete",  resource: "execution",   action: "delete", description: "Delete execution entities" },
  { name: "execution:admin",   resource: "execution",   action: "admin",  description: "Full execution administration" },
  { name: "ai:read",           resource: "ai",          action: "read",   description: "View AI insights and reports" },
  { name: "ai:write",          resource: "ai",          action: "write",  description: "Generate AI content" },
  { name: "operations:read",   resource: "operations",  action: "read",   description: "View ops metrics and health" },
  { name: "operations:write",  resource: "operations",  action: "write",  description: "Acknowledge alerts and incidents" },
  { name: "operations:admin",  resource: "operations",  action: "admin",  description: "Full operations administration" },
  { name: "users:read",        resource: "users",       action: "read",   description: "View user and org data" },
  { name: "users:write",       resource: "users",       action: "write",  description: "Manage users and memberships" },
  { name: "users:delete",      resource: "users",       action: "delete", description: "Delete users and revoke access" },
  { name: "users:admin",       resource: "users",       action: "admin",  description: "Full user administration (cross-org)" },
  { name: "billing:read",      resource: "billing",     action: "read",   description: "View billing and subscription" },
  { name: "billing:admin",     resource: "billing",     action: "admin",  description: "Manage billing and subscription" },
  { name: "streams:read",      resource: "streams",     action: "read",   description: "View streaming data" },
  { name: "intelligence:read", resource: "intelligence", action: "read",  description: "View intelligence layer data" },
  { name: "intelligence:write",resource: "intelligence", action: "write", description: "Trigger intelligence operations" },
];

const SYSTEM_ROLES: Array<{ name: RoleName; description: string }> = [
  { name: "super_admin",       description: "Platform super administrator — unrestricted access" },
  { name: "org_owner",         description: "Organization owner — full org access" },
  { name: "admin",             description: "Organization admin — most org capabilities" },
  { name: "portfolio_manager", description: "Portfolio manager — portfolio, research, AI access" },
  { name: "trader",            description: "Trader — execution and position access" },
  { name: "analyst",           description: "Analyst — research and portfolio read access" },
  { name: "viewer",            description: "Viewer — read-only access across all domains" },
];

/**
 * Seed all system roles and permissions into the DB.
 * Idempotent — safe to call on every server startup.
 */
export async function seedRolesAndPermissions(): Promise<void> {
  // Upsert permissions
  const permMap: Record<string, string> = {};
  for (const perm of SYSTEM_PERMISSIONS) {
    const p = await upsertPermission({ name: perm.name, resource: perm.resource, action: perm.action, description: perm.description });
    permMap[perm.name] = p.id;
  }

  // Upsert roles and assign permissions
  for (const roleDef of SYSTEM_ROLES) {
    const role = await upsertRole({ name: roleDef.name, description: roleDef.description, isSystem: true, isActive: true });
    const permNames = ROLE_PERMISSION_MATRIX[roleDef.name] ?? [];
    const permIds = permNames.map(n => permMap[n]).filter(Boolean) as string[];
    await setRolePermissions(role.id, permIds);
  }

  logger.info("RBAC: roles and permissions seeded");
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * Check if a user has a specific permission.
 * Super admins bypass all permission checks.
 */
export function hasPermission(userPermissions: string[], required: PermissionName, isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  return userPermissions.includes(required);
}

/**
 * Check if a user has ALL of the specified permissions.
 */
export function hasAllPermissions(userPermissions: string[], required: PermissionName[], isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  return required.every(p => userPermissions.includes(p));
}

/**
 * Check if a user has ANY of the specified permissions.
 */
export function hasAnyPermission(userPermissions: string[], required: PermissionName[], isSuperAdmin = false): boolean {
  if (isSuperAdmin) return true;
  return required.some(p => userPermissions.includes(p));
}

// ---------------------------------------------------------------------------
// Role management
// ---------------------------------------------------------------------------

export async function getRoleWithPermissions(roleId: string): Promise<{ role: Role; permissions: Permission[] } | null> {
  const role = await findRoleById(roleId);
  if (!role) return null;
  const permissions = await getPermissionsForRole(roleId);
  return { role, permissions };
}

export async function assignRole(opts: {
  userId: string;
  roleName: RoleName;
  organizationId?: string | null;
  grantedBy?: string | null;
}): Promise<UserRole> {
  const role = await findRoleByName(opts.roleName);
  if (!role) throw new Error(`Role not found: ${opts.roleName}`);
  return assignUserRole({
    userId: opts.userId,
    roleId: role.id,
    organizationId: opts.organizationId ?? null,
    grantedBy: opts.grantedBy ?? null,
  });
}

export async function getUserEffectivePermissions(userId: string, organizationId?: string | null): Promise<string[]> {
  return getEffectivePermissionsForUser(userId, organizationId);
}

export async function getUserRoleNames(userId: string, organizationId?: string | null): Promise<string[]> {
  const userRoles = await listUserRoles(userId, organizationId);
  const globalRoles = organizationId ? await listUserRoles(userId, null) : [];
  const allRoleIds = [...new Set([...userRoles, ...globalRoles].map(r => r.roleId))];
  const roleNames: string[] = [];
  for (const roleId of allRoleIds) {
    const role = await findRoleById(roleId);
    if (role) roleNames.push(role.name);
  }
  return roleNames;
}

export { listRoles, listPermissions, listUserRoles, removeUserRole, findRoleByName, findRoleById };
