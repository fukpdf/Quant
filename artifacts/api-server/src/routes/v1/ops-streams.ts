import { Router } from "express";
import { listLatestStreamHealthHistory } from "../../services/ops-db";

/**
 * ops-streams.ts — Stream health monitoring endpoint.
 *
 * GET /v1/ops/stream-health — latest stream health per provider (from monitoring history)
 */

const router = Router();

// GET /v1/ops/stream-health
router.get("/ops/stream-health", async (req, res) => {
  try {
    const rows = await listLatestStreamHealthHistory();
    const data = rows.map((r) => r.s);
    return res.json({ data, count: data.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to get stream health");
    return res.status(500).json({ error: "Failed to get stream health" });
  }
});

export default router;
