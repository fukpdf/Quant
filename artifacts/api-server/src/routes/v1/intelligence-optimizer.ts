import { Router } from "express";
import { z } from "zod/v4";
import {
  startOptimizationRun,
  getOptimizationRunById,
  listOptimizationRuns,
  listOptimizationResults,
} from "../../services/strategy-optimizer";

/**
 * intelligence-optimizer.ts — Strategy Parameter Optimization endpoints.
 *
 * POST /v1/intelligence/optimizer/runs              — start optimization run
 * GET  /v1/intelligence/optimizer/runs              — list runs
 * GET  /v1/intelligence/optimizer/runs/:id          — get run detail
 * GET  /v1/intelligence/optimizer/runs/:id/results  — get trial results
 */

const router = Router();

const ParameterRangeSchema = z.object({
  min: z.number(),
  max: z.number(),
  step: z.number().optional(),
  type: z.enum(["int", "float"]).optional(),
  values: z.array(z.union([z.number(), z.string()])).optional(),
});

const StartOptimizationSchema = z.object({
  strategyName: z.string().min(1).max(100),
  method: z.enum(["grid_search", "random_search", "bayesian", "genetic"]),
  objective: z.enum(["sharpe", "calmar", "total_return", "sortino", "profit_factor"]).optional().default("sharpe"),
  parameterSpace: z.record(z.string(), ParameterRangeSchema).refine((v) => Object.keys(v).length > 0, {
    message: "parameterSpace must have at least one parameter",
  }),
  symbol: z.string().min(2).max(30),
  timeframe: z.string().min(1).max(10).optional().default("1d"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  maxIterations: z.number().int().min(1).max(10000).optional(),
  populationSize: z.number().int().min(5).max(200).optional(),
  maxGenerations: z.number().int().min(1).max(100).optional(),
  mutationRate: z.number().min(0).max(1).optional(),
  explorationTrials: z.number().int().min(5).max(100).optional(),
});

// POST /v1/intelligence/optimizer/runs
router.post("/intelligence/optimizer/runs", async (req, res) => {
  const parsed = StartOptimizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    const runId = await startOptimizationRun(parsed.data as Parameters<typeof startOptimizationRun>[0]);
    const run = await getOptimizationRunById(runId);
    return res.status(202).json({
      data: run,
      message: "Optimization run started. Poll GET /v1/intelligence/optimizer/runs/:id for status.",
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to start optimization run");
    return res.status(500).json({ error: "Failed to start optimization run" });
  }
});

// GET /v1/intelligence/optimizer/runs
router.get("/intelligence/optimizer/runs", async (req, res) => {
  const strategyName = typeof req.query.strategy_name === "string" ? req.query.strategy_name : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const method = typeof req.query.method === "string" ? req.query.method : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const runs = await listOptimizationRuns({ strategyName, status, method, limit, offset });
    return res.json({ data: runs, count: runs.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list optimization runs");
    return res.status(500).json({ error: "Failed to list optimization runs" });
  }
});

// GET /v1/intelligence/optimizer/runs/:id
router.get("/intelligence/optimizer/runs/:id", async (req, res) => {
  try {
    const run = await getOptimizationRunById(req.params.id);
    if (!run) return res.status(404).json({ error: "Optimization run not found" });
    return res.json({ data: run });
  } catch (err) {
    req.log?.error({ err }, "Failed to get optimization run");
    return res.status(500).json({ error: "Failed to get optimization run" });
  }
});

// GET /v1/intelligence/optimizer/runs/:id/results
router.get("/intelligence/optimizer/runs/:id/results", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
  try {
    const run = await getOptimizationRunById(req.params.id);
    if (!run) return res.status(404).json({ error: "Optimization run not found" });
    const results = await listOptimizationResults(req.params.id, limit);
    return res.json({ data: results, count: results.length, run: { id: run.id, status: run.status } });
  } catch (err) {
    req.log?.error({ err }, "Failed to get optimization results");
    return res.status(500).json({ error: "Failed to get optimization results" });
  }
});

export default router;
