import { Router, type IRouter } from "express";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { listSecurityEvents } from "../../services/auth-db";

const router: IRouter = Router();

/**
 * GET /v1/security/events
 * List security events. operations:read or users:read required.
 * Regular users see only their own events.
 */
router.get("/security/events", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const offset = Number(req.query["offset"] ?? 0);
  const eventType = req.query["eventType"] as string | undefined;
  const severity = req.query["severity"] as string | undefined;

  const hasAdminAccess = auth.isSuperAdmin || auth.permissions.includes("operations:read") || auth.permissions.includes("users:read");
  const userId = hasAdminAccess ? (req.query["userId"] as string | undefined) : auth.userId;

  try {
    const events = await listSecurityEvents({ userId, eventType, severity, limit, offset });
    res.json({ data: events, total: events.length });
  } catch (err) {
    req.log.error({ err }, "List security events failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list security events." } });
  }
});

export default router;
