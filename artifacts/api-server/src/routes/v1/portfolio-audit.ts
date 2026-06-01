import { Router, type IRouter } from "express";
import { listAnalyticsAuditLog } from "../../services/analytics-db";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/audit-log?accountId=...&action=...&limit=100
 * Returns the analytics audit log (immutable, append-only).
 */
router.get("/portfolio/audit-log", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const action = req.query["action"] as string | undefined;
  const limitStr = req.query["limit"] as string | undefined;
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 100, 500) : 100;

  const entries = await listAnalyticsAuditLog({ accountId, action, limit });
  res.json({ data: entries, total: entries.length });
});

export default router;
