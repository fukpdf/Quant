import { Router } from "express";
import { getLatestExecutionHealth } from "../../services/ops-db";
import { runExecutionHealthChecks } from "../../services/execution-health-engine";

/**
 * ops-execution.ts — Execution engine health endpoints.
 *
 * GET  /v1/ops/execution-health              — latest execution health by window
 * POST /v1/ops/execution-health/refresh      — trigger immediate refresh
 */

const router = Router();

// GET /v1/ops/execution-health
router.get("/ops/execution-health", async (req, res) => {
  const window = typeof req.query.window === "string" ? req.query.window : "1h";

  try {
    const row = await getLatestExecutionHealth(window);
    if (!row) {
      return res.status(404).json({ error: "No execution health data available for window: " + window });
    }
    return res.json({ data: row });
  } catch (err) {
    req.log?.error({ err }, "Failed to get execution health");
    return res.status(500).json({ error: "Failed to get execution health" });
  }
});

// POST /v1/ops/execution-health/refresh
router.post("/ops/execution-health/refresh", async (req, res) => {
  try {
    await runExecutionHealthChecks();
    const row = await getLatestExecutionHealth("1h");
    return res.status(201).json({ data: row, message: "Execution health refreshed" });
  } catch (err) {
    req.log?.error({ err }, "Failed to refresh execution health");
    return res.status(500).json({ error: "Failed to refresh execution health" });
  }
});

export default router;
