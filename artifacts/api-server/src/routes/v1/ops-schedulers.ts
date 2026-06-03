import { Router } from "express";
import { getSchedulerHealthSummary, getInMemorySchedulerStates } from "../../services/scheduler-monitor";

/**
 * ops-schedulers.ts — Scheduler health endpoints.
 *
 * GET /v1/ops/schedulers          — latest scheduler health (DB + in-memory)
 * GET /v1/ops/schedulers/live     — in-memory scheduler states (no DB round-trip)
 */

const router = Router();

// GET /v1/ops/schedulers
router.get("/ops/schedulers", async (req, res) => {
  try {
    const rows = await getSchedulerHealthSummary();
    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list scheduler health");
    return res.status(500).json({ error: "Failed to list scheduler health" });
  }
});

// GET /v1/ops/schedulers/live
router.get("/ops/schedulers/live", async (req, res) => {
  try {
    const states = getInMemorySchedulerStates();
    return res.json({ data: states, count: states.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to get live scheduler states");
    return res.status(500).json({ error: "Failed to get live scheduler states" });
  }
});

export default router;
