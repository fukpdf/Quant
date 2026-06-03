import { Router } from "express";
import { z } from "zod/v4";
import { listGenerations } from "../../services/genetic-evolution-engine";
import { listMutationsForGeneration } from "../../services/intelligence-db";
import { listStrategyLineage } from "../../services/intelligence-db";

/**
 * intelligence-evolution.ts — Strategy Evolution & Lineage endpoints.
 *
 * GET /v1/intelligence/evolution/generations     — list GA generation individuals
 * GET /v1/intelligence/evolution/mutations/:id   — get mutations for a generation row
 * GET /v1/intelligence/lineage                   — list strategy lineage records
 */

const router = Router();

// GET /v1/intelligence/evolution/generations
router.get("/intelligence/evolution/generations", async (req, res) => {
  const populationId = typeof req.query.population_id === "string" ? req.query.population_id : undefined;
  const strategyName = typeof req.query.strategy_name === "string" ? req.query.strategy_name : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);

  try {
    const generations = await listGenerations({ populationId, strategyName, status, limit });
    return res.json({ data: generations, count: generations.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list generations");
    return res.status(500).json({ error: "Failed to list generations" });
  }
});

// GET /v1/intelligence/evolution/mutations/:generationId
router.get("/intelligence/evolution/mutations/:generationId", async (req, res) => {
  try {
    const mutations = await listMutationsForGeneration(req.params.generationId);
    return res.json({ data: mutations, count: mutations.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list mutations");
    return res.status(500).json({ error: "Failed to list mutations" });
  }
});

// GET /v1/intelligence/lineage
router.get("/intelligence/lineage", async (req, res) => {
  const lineageType = typeof req.query.lineage_type === "string" ? req.query.lineage_type : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const lineage = await listStrategyLineage({ lineageType, limit, offset });
    return res.json({ data: lineage, count: lineage.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list strategy lineage");
    return res.status(500).json({ error: "Failed to list strategy lineage" });
  }
});

export default router;
