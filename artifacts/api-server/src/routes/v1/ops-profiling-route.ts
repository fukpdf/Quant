import { Router, type IRouter } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import {
  getCurrentSnapshot,
  getSnapshotHistory,
  getApiLatencyByPath,
  getSystemMetricsHistory,
  takeSnapshot,
} from "../../services/performance-profiler";

const router: IRouter = Router();

/**
 * GET /api/v1/ops/profiling
 * Return the current performance snapshot (live in-memory).
 */
router.get("/ops/profiling", requireAuth, requirePermission("operations:read"), async (_req, res) => {
  try {
    const snapshot = getCurrentSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: "Failed to get performance snapshot" });
  }
});

/**
 * GET /api/v1/ops/profiling/snapshots
 * Return recent profiling snapshots (last N).
 */
router.get("/ops/profiling/snapshots", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 60), 288);
    const snapshots = getSnapshotHistory(limit);
    res.json(snapshots);
  } catch (err) {
    res.status(500).json({ error: "Failed to get profiling snapshots" });
  }
});

/**
 * POST /api/v1/ops/profiling/snapshot
 * Force a profiling snapshot and return it.
 */
router.post("/ops/profiling/snapshot", requireAuth, requirePermission("operations:write"), async (_req, res) => {
  try {
    const snapshot = takeSnapshot();
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: "Failed to take profiling snapshot" });
  }
});

/**
 * GET /api/v1/ops/profiling/api-latency
 * Return per-endpoint API latency breakdown.
 */
router.get("/ops/profiling/api-latency", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
    const latency = getApiLatencyByPath(limit);
    res.json(latency);
  } catch (err) {
    res.status(500).json({ error: "Failed to get API latency breakdown" });
  }
});

/**
 * GET /api/v1/ops/profiling/metrics-history
 * Return system metrics history from DB.
 */
router.get("/ops/profiling/metrics-history", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const hours = Math.min(Number(req.query["hours"] ?? 1), 24);
    const metrics = await getSystemMetricsHistory(hours);
    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: "Failed to get metrics history" });
  }
});

export default router;
