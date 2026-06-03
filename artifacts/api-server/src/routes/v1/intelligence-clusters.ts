import { Router } from "express";
import { z } from "zod/v4";
import {
  computeAndPersistClusters,
  buildCorrelationMatrix,
  listStrategyClusters,
} from "../../services/intelligence-correlation-engine";
import type { ClusterMethod } from "../../services/intelligence-types";

/**
 * intelligence-clusters.ts — Strategy Clustering & Correlation endpoints.
 *
 * GET  /v1/intelligence/clusters             — list strategy clusters
 * POST /v1/intelligence/clusters/compute     — trigger cluster computation
 * GET  /v1/intelligence/clusters/correlation — pairwise correlation matrix
 */

const router = Router();

const ComputeClustersSchema = z.object({
  method: z.enum(["correlation", "performance", "regime", "combined"]).optional().default("correlation"),
  threshold: z.number().min(0.1).max(0.9).optional().default(0.4),
});

// GET /v1/intelligence/clusters
router.get("/intelligence/clusters", async (req, res) => {
  const method = typeof req.query.method === "string" ? req.query.method : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : "active";
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);

  try {
    const clusters = await listStrategyClusters({ method, status, limit });
    return res.json({ data: clusters, count: clusters.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list strategy clusters");
    return res.status(500).json({ error: "Failed to list strategy clusters" });
  }
});

// POST /v1/intelligence/clusters/compute
router.post("/intelligence/clusters/compute", async (req, res) => {
  const parsed = ComputeClustersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    const result = await computeAndPersistClusters(parsed.data.method as ClusterMethod);
    return res.status(201).json({ data: result });
  } catch (err) {
    req.log?.error({ err }, "Failed to compute strategy clusters");
    return res.status(500).json({ error: "Failed to compute strategy clusters" });
  }
});

// GET /v1/intelligence/clusters/correlation
router.get("/intelligence/clusters/correlation", async (req, res) => {
  try {
    const matrix = await buildCorrelationMatrix();
    return res.json({ data: matrix });
  } catch (err) {
    req.log?.error({ err }, "Failed to build correlation matrix");
    return res.status(500).json({ error: "Failed to build correlation matrix" });
  }
});

export default router;
