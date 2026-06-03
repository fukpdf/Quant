import { Router } from "express";
import { listUptimeHistory } from "../../services/ops-db";

/**
 * ops-uptime.ts — Service uptime history endpoint.
 *
 * GET /v1/ops/uptime — list uptime history with optional service filter
 */

const router = Router();

// GET /v1/ops/uptime
router.get("/ops/uptime", async (req, res) => {
  const service = typeof req.query.service === "string" ? req.query.service : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
  const sinceStr = typeof req.query.since === "string" ? req.query.since : undefined;
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    const rows = await listUptimeHistory({ service, since, limit });
    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to get uptime history");
    return res.status(500).json({ error: "Failed to get uptime history" });
  }
});

export default router;
