import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission, requireSelfOrAdmin } from "../../middleware/rbac-middleware";
import { listUsers, findUserById, updateUser } from "../../services/auth-db";
import { toSafeUser } from "../../services/auth-service";
import { revokeAllSessions } from "../../services/session-service";
import { auditLog } from "../../services/auth-audit-service";

const router: IRouter = Router();

/**
 * GET /v1/users
 * List all users. Requires users:read permission.
 */
router.get("/users", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  const activeOnly = req.query["activeOnly"] !== "false";
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const offset = Number(req.query["offset"] ?? 0);

  try {
    const users = await listUsers({ activeOnly, limit, offset });
    res.json({ data: users.map(toSafeUser), total: users.length });
  } catch (err) {
    req.log.error({ err }, "List users failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list users." } });
  }
});

/**
 * GET /v1/users/:userId
 * Get a specific user. Requires users:read or self.
 */
router.get("/users/:userId", resolveAuth, requireAuth, requireSelfOrAdmin, async (req, res) => {
  const { userId } = req.params as Record<string, string>;
  try {
    const user = await findUserById(userId);
    if (!user) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    req.log.error({ err }, "Get user failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get user." } });
  }
});

const UpdateUserAdminSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  isSuperAdmin: z.boolean().optional(),
}).strict();

/**
 * PATCH /v1/users/:userId
 * Update a user. Requires users:write or self (for own non-admin fields).
 */
router.patch("/users/:userId", resolveAuth, requireAuth, requireSelfOrAdmin, async (req, res) => {
  const auth = req.auth!;
  const { userId } = req.params as Record<string, string>;
  const parse = UpdateUserAdminSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  // Only admins can change isActive / isSuperAdmin
  if ((parse.data.isActive !== undefined || parse.data.isSuperAdmin !== undefined) && !auth.isSuperAdmin && !auth.permissions.includes("users:admin")) {
    res.status(403).json({ error: { code: "FORBIDDEN", message: "Admin permission required to modify account status." } });
    return;
  }

  try {
    const existing = await findUserById(userId);
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }
    const updated = await updateUser(userId, parse.data);
    await auditLog({ actorId: auth.userId, actorEmail: auth.email, action: "user.update", resource: "user", resourceId: userId, beforeState: { firstName: existing.firstName, lastName: existing.lastName, isActive: existing.isActive }, afterState: parse.data });
    res.json({ user: toSafeUser(updated!) });
  } catch (err) {
    req.log.error({ err }, "Update user failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update user." } });
  }
});

/**
 * POST /v1/users/:userId/deactivate
 * Deactivate a user account and revoke all sessions. Requires users:delete.
 */
router.post("/users/:userId/deactivate", resolveAuth, requireAuth, requirePermission("users:delete"), async (req, res) => {
  const auth = req.auth!;
  const { userId } = req.params as Record<string, string>;

  if (userId === auth.userId) {
    res.status(400).json({ error: { code: "CANNOT_SELF_DEACTIVATE", message: "You cannot deactivate your own account." } });
    return;
  }

  try {
    const existing = await findUserById(userId);
    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }
    await updateUser(userId, { isActive: false });
    await revokeAllSessions(userId, "account_deactivated");
    await auditLog({ actorId: auth.userId, actorEmail: auth.email, action: "user.deactivate", resource: "user", resourceId: userId, beforeState: { isActive: true }, afterState: { isActive: false } });
    res.json({ message: "User deactivated and all sessions revoked." });
  } catch (err) {
    req.log.error({ err }, "Deactivate user failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to deactivate user." } });
  }
});

export default router;
