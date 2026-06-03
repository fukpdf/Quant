import { Router } from "express";
import { listLatestAiHealth } from "../../services/ops-db";
import { runAiHealthChecks } from "../../services/ai-health-engine";

/**
 * ops-ai.ts — AI system health endpoints.
 *
 * GET  /v1/ops/ai-health             — latest AI health per provider/window
 * POST /v1/ops/ai-health/refresh     — trigger immediate AI health check
 */

const router = Router();

// GET /v1/ops/ai-health
router.get("/ops/ai-health", async (req, res) => {
  try {
    const rows = await listLatestAiHealth();
    const data = rows.map((r) => r.a);
    return res.json({ data, count: data.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to get AI health");
    return res.status(500).json({ error: "Failed to get AI health" });
  }
});

// POST /v1/ops/ai-health/refresh
router.post("/ops/ai-health/refresh", async (req, res) => {
  try {
    await runAiHealthChecks();
    const rows = await listLatestAiHealth();
    const data = rows.map((r) => r.a);
    return res.status(201).json({ data, count: data.length, message: "AI health refreshed" });
  } catch (err) {
    req.log?.error({ err }, "Failed to refresh AI health");
    return res.status(500).json({ error: "Failed to refresh AI health" });
  }
});

export default router;
