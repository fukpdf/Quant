import { Router } from "express";
import { listLatestServiceHealth, listServiceHealthHistory } from "../../services/ops-db";

/**
 * ops-services.ts — Service health endpoints.
 *
 * GET /v1/ops/services                      — latest health per service
 * GET /v1/ops/services/:service/history     — health history for a service
 */

const router = Router();

// GET /v1/ops/services
router.get("/ops/services", async (req, res) => {
  try {
    const rows = await listLatestServiceHealth();
    const services = rows.map((r) => r.sh);
    return res.json({ data: services, count: services.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list service health");
    return res.status(500).json({ error: "Failed to list service health" });
  }
});

// GET /v1/ops/services/:service/history
router.get("/ops/services/:service/history", async (req, res) => {
  const { service } = req.params;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);

  try {
    const rows = await listServiceHealthHistory(service, limit);
    return res.json({ data: rows, count: rows.length, service });
  } catch (err) {
    req.log?.error({ err }, "Failed to get service health history");
    return res.status(500).json({ error: "Failed to get service health history" });
  }
});

export default router;
