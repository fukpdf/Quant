import { Router } from "express";
import { getLatestPerformanceSnapshot, listPerformanceSnapshots } from "../../services/ops-db";

/**
 * ops-performance.ts — Platform performance snapshot endpoints.
 *
 * GET /v1/ops/performance          — list performance snapshots
 * GET /v1/ops/performance/latest   — most recent snapshot
 */

const router = Router();

// GET /v1/ops/performance/latest
router.get("/ops/performance/latest", async (req, res) => {
  try {
    const snapshot = await getLatestPerformanceSnapshot();
    if (!snapshot) {
      return res.status(404).json({ error: "No performance snapshot available yet" });
    }
    return res.json({ data: snapshot });
  } catch (err) {
    req.log?.error({ err }, "Failed to get latest performance snapshot");
    return res.status(500).json({ error: "Failed to get latest performance snapshot" });
  }
});

// GET /v1/ops/performance
router.get("/ops/performance", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "96")), 500);
  const sinceStr = typeof req.query.since === "string" ? req.query.since : undefined;
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    const snapshots = await listPerformanceSnapshots({ since, limit });
    return res.json({ data: snapshots, count: snapshots.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list performance snapshots");
    return res.status(500).json({ error: "Failed to list performance snapshots" });
  }
});

export default router;
