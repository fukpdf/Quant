import { Router, type IRouter } from "express";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission, requireSuperAdmin } from "../../middleware/rbac-middleware";
import { listRoles, getRoleWithPermissions, assignRole, listUserRoles, removeUserRole } from "../../services/rbac-service";
import { auditRoleAssigned } from "../../services/auth-audit-service";
import { z } from "zod";
import type { RoleName } from "../../services/auth-types";

const router: IRouter = Router();

/**
 * GET /v1/rbac/roles
 * List all available roles. Requires users:read.
 */
router.get("/rbac/roles", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  try {
    const roles = await listRoles();
    res.json({ data: roles, total: roles.length });
  } catch (err) {
    req.log.error({ err }, "List roles failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list roles." } });
  }
});

/**
 * GET /v1/rbac/roles/:roleId
 * Get a role with its permissions. Requires users:read.
 */
router.get("/rbac/roles/:roleId", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  const { roleId } = req.params as Record<string, string>;
  try {
    const data = await getRoleWithPermissions(roleId);
    if (!data) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Role not found." } });
      return;
    }
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Get role failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get role." } });
  }
});

const AssignRoleSchema = z.object({
  userId: z.string().uuid(),
  roleName: z.string().min(1),
  organizationId: z.string().uuid().optional().nullable(),
});

/**
 * POST /v1/rbac/roles/assign
 * Assign a role to a user. Requires users:admin.
 */
router.post("/rbac/roles/assign", resolveAuth, requireAuth, requirePermission("users:admin"), async (req, res) => {
  const auth = req.auth!;
  const parse = AssignRoleSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const userRole = await assignRole({ userId: parse.data.userId, roleName: parse.data.roleName as RoleName, organizationId: parse.data.organizationId ?? null, grantedBy: auth.userId });
    await auditRoleAssigned({ actorId: auth.userId, actorEmail: auth.email, targetUserId: parse.data.userId, roleName: parse.data.roleName, organizationId: parse.data.organizationId ?? null });
    res.status(201).json({ userRole });
  } catch (err) {
    req.log.error({ err }, "Assign role failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to assign role." } });
  }
});

/**
 * GET /v1/rbac/users/:userId/roles
 * List all roles assigned to a user. Requires users:read.
 */
router.get("/rbac/users/:userId/roles", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  const { userId } = req.params as Record<string, string>;
  try {
    const userRoles = await listUserRoles(userId);
    res.json({ data: userRoles, total: userRoles.length });
  } catch (err) {
    req.log.error({ err }, "List user roles failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list user roles." } });
  }
});

/**
 * DELETE /v1/rbac/user-roles/:userRoleId
 * Remove a role assignment. Requires users:admin.
 */
router.delete("/rbac/user-roles/:userRoleId", resolveAuth, requireAuth, requirePermission("users:admin"), async (req, res) => {
  const { userRoleId } = req.params as Record<string, string>;
  try {
    await removeUserRole(userRoleId);
    res.json({ message: "Role assignment removed." });
  } catch (err) {
    req.log.error({ err }, "Remove user role failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove role assignment." } });
  }
});

export default router;
