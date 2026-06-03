import { Router, type IRouter } from "express";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { listPermissions, getUserEffectivePermissions } from "../../services/rbac-service";

const router: IRouter = Router();

/**
 * GET /v1/rbac/permissions
 * List all permissions in the system. Requires users:read.
 */
router.get("/rbac/permissions", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  try {
    const permissions = await listPermissions();
    res.json({ data: permissions, total: permissions.length });
  } catch (err) {
    req.log.error({ err }, "List permissions failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list permissions." } });
  }
});

/**
 * GET /v1/rbac/users/:userId/permissions
 * Get the effective permissions for a user (optional org scope via ?orgId=).
 * Requires users:read.
 */
router.get("/rbac/users/:userId/permissions", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  const { userId } = req.params as Record<string, string>;
  const orgId = (req.query["orgId"] as string | undefined) ?? null;
  try {
    const permissions = await getUserEffectivePermissions(userId, orgId);
    res.json({ data: permissions, total: permissions.length });
  } catch (err) {
    req.log.error({ err }, "Get user permissions failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get user permissions." } });
  }
});

export default router;
