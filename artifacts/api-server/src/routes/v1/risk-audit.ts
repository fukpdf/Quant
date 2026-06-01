import { Router, type IRouter } from "express";
import { listAuditLog } from "../../services/risk-db";

const router: IRouter = Router();

/**
 * GET /v1/risk/audit-log
 * Retrieve the immutable risk system audit log.
 */
router.get("/risk/audit-log", async (req, res) => {
  const { action, entityType, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 200;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–1000" } });
    return;
  }

  const entries = await listAuditLog({ action, entityType, limit: parsedLimit });
  res.json({ data: entries, total: entries.length });
});

export default router;
