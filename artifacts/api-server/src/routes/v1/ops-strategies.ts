import { Router } from "express";
import { listLatestStrategyHealth } from "../../services/ops-db";
import { runStrategyHealthChecks } from "../../services/strategy-health-engine";

/**
 * ops-strategies.ts — Strategy health monitoring endpoints.
 *
 * GET  /v1/ops/strategy-health           — latest health per strategy
 * POST /v1/ops/strategy-health/refresh   — trigger immediate health check
 */

const router = Router();

// GET /v1/ops/strategy-health
router.get("/ops/strategy-health", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);

  try {
    const rows = await listLatestStrategyHealth(limit);
    const data = rows.map((r) => r.s);
    return res.json({ data, count: data.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list strategy health");
    return res.status(500).json({ error: "Failed to list strategy health" });
  }
});

// POST /v1/ops/strategy-health/refresh
router.post("/ops/strategy-health/refresh", async (req, res) => {
  try {
    await runStrategyHealthChecks();
    const rows = await listLatestStrategyHealth(50);
    const data = rows.map((r) => r.s);
    return res.status(201).json({ data, count: data.length, message: "Strategy health refreshed" });
  } catch (err) {
    req.log?.error({ err }, "Failed to refresh strategy health");
    return res.status(500).json({ error: "Failed to refresh strategy health" });
  }
});

export default router;
