import { Router } from "express";
import { listMonitoringAuditLog } from "../../services/ops-db";

/**
 * ops-audit.ts — Monitoring audit log endpoint.
 *
 * GET /v1/ops/audit-log — list all monitoring operations audit trail
 */

const router = Router();

// GET /v1/ops/audit-log
router.get("/ops/audit-log", async (req, res) => {
  const action = typeof req.query.action === "string" ? req.query.action : undefined;
  const actor = typeof req.query.actor === "string" ? req.query.actor : undefined;
  const targetType = typeof req.query.targetType === "string" ? req.query.targetType : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
  const offset = parseInt(String(req.query.offset ?? "0"));
  const sinceStr = typeof req.query.since === "string" ? req.query.since : undefined;
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    const rows = await listMonitoringAuditLog({ action, actor, targetType, since, limit, offset });
    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list monitoring audit log");
    return res.status(500).json({ error: "Failed to list monitoring audit log" });
  }
});

export default router;
