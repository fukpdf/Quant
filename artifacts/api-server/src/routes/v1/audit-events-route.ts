import { Router, type IRouter } from "express";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { listAuditEvents } from "../../services/auth-db";

const router: IRouter = Router();

/**
 * GET /v1/audit/events
 * List audit trail events. Requires operations:read.
 */
router.get("/audit/events", resolveAuth, requireAuth, requirePermission("operations:read"), async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
  const offset = Number(req.query["offset"] ?? 0);
  const actorId = req.query["actorId"] as string | undefined;
  const resource = req.query["resource"] as string | undefined;
  const action = req.query["action"] as string | undefined;
  const organizationId = req.query["organizationId"] as string | undefined;

  try {
    const events = await listAuditEvents({ actorId, resource, action, organizationId, limit, offset });
    res.json({ data: events, total: events.length });
  } catch (err) {
    req.log.error({ err }, "List audit events failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list audit events." } });
  }
});

export default router;
