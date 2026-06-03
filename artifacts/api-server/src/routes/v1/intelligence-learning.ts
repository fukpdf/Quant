import { Router } from "express";
import {
  computeIntelligenceHealth,
  computeLearningMetrics,
} from "../../services/continuous-learning-engine";
import { runFullIntelligenceRefresh, runCoordinationCycle } from "../../services/research-coordinator";
import { getSchedulerStatus } from "../../services/intelligence-scheduler";

/**
 * intelligence-learning.ts — Continuous Learning & Intelligence Status endpoints.
 *
 * GET  /v1/intelligence/status            — overall intelligence layer status
 * GET  /v1/intelligence/learning/health   — intelligence health report
 * GET  /v1/intelligence/learning/metrics  — raw learning metrics snapshot
 * POST /v1/intelligence/learning/refresh  — trigger full intelligence refresh
 * POST /v1/intelligence/learning/cycle    — run one research coordination cycle
 */

const router = Router();

// GET /v1/intelligence/status
router.get("/intelligence/status", async (req, res) => {
  try {
    const [scheduler, metrics] = await Promise.all([
      Promise.resolve(getSchedulerStatus()),
      computeLearningMetrics(),
    ]);

    return res.json({
      data: {
        scheduler,
        metrics,
        advisoryBoundary:
          "Intelligence layer is ADVISORY ONLY — no trades, orders, or positions are affected by this layer",
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to get intelligence status");
    return res.status(500).json({ error: "Failed to get intelligence status" });
  }
});

// GET /v1/intelligence/learning/health
router.get("/intelligence/learning/health", async (req, res) => {
  try {
    const health = await computeIntelligenceHealth();
    return res.json({ data: health });
  } catch (err) {
    req.log?.error({ err }, "Failed to compute intelligence health");
    return res.status(500).json({ error: "Failed to compute intelligence health" });
  }
});

// GET /v1/intelligence/learning/metrics
router.get("/intelligence/learning/metrics", async (req, res) => {
  try {
    const metrics = await computeLearningMetrics();
    return res.json({ data: metrics });
  } catch (err) {
    req.log?.error({ err }, "Failed to get learning metrics");
    return res.status(500).json({ error: "Failed to get learning metrics" });
  }
});

// POST /v1/intelligence/learning/refresh
router.post("/intelligence/learning/refresh", async (req, res) => {
  try {
    // Run asynchronously — don't block the HTTP response
    setImmediate(() => runFullIntelligenceRefresh());
    return res.status(202).json({
      message: "Full intelligence refresh started — rankings, clusters, and regime detection are updating",
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to trigger intelligence refresh");
    return res.status(500).json({ error: "Failed to trigger intelligence refresh" });
  }
});

// POST /v1/intelligence/learning/cycle
router.post("/intelligence/learning/cycle", async (req, res) => {
  try {
    const result = await runCoordinationCycle();
    return res.status(200).json({ data: result });
  } catch (err) {
    req.log?.error({ err }, "Failed to run coordination cycle");
    return res.status(500).json({ error: "Failed to run coordination cycle" });
  }
});

export default router;
