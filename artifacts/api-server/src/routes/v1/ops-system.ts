import { Router } from "express";
import { getLatestSystemMetrics, listSystemMetrics } from "../../services/ops-db";
import { getCurrentMetricsSnapshot } from "../../services/metrics-collector";

/**
 * ops-system.ts — System metrics endpoints.
 *
 * GET /v1/ops/system-metrics           — list historical system metrics
 * GET /v1/ops/system-metrics/latest    — latest persisted metrics
 * GET /v1/ops/system-metrics/live      — live snapshot (no DB round-trip)
 */

const router = Router();

// GET /v1/ops/system-metrics/live
router.get("/ops/system-metrics/live", async (req, res) => {
  try {
    const snapshot = getCurrentMetricsSnapshot();
    return res.json({ data: snapshot });
  } catch (err) {
    req.log?.error({ err }, "Failed to get live system metrics");
    return res.status(500).json({ error: "Failed to get live system metrics" });
  }
});

// GET /v1/ops/system-metrics/latest
router.get("/ops/system-metrics/latest", async (req, res) => {
  try {
    const row = await getLatestSystemMetrics();
    if (!row) {
      return res.status(404).json({ error: "No system metrics available yet" });
    }
    return res.json({ data: row });
  } catch (err) {
    req.log?.error({ err }, "Failed to get latest system metrics");
    return res.status(500).json({ error: "Failed to get latest system metrics" });
  }
});

// GET /v1/ops/system-metrics
router.get("/ops/system-metrics", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "60")), 500);
  const sinceStr = typeof req.query.since === "string" ? req.query.since : undefined;
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    const rows = await listSystemMetrics({ limit, since });
    return res.json({ data: rows, count: rows.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list system metrics");
    return res.status(500).json({ error: "Failed to list system metrics" });
  }
});

export default router;
