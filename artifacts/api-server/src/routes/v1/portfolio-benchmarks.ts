import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  listBenchmarks,
  getBenchmark,
  createBenchmark,
  updateBenchmark,
  listBenchmarkSnapshots,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { refreshBenchmarkSnapshots, seedDefaultBenchmarks } from "../../services/benchmark-service";

const router: IRouter = Router();

const CreateBenchmarkSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  benchmarkType: z.enum(["btc", "eth", "sol", "custom", "basket"]).default("custom"),
  symbol: z.string().max(30).optional(),
  basketComposition: z.array(z.object({
    symbol: z.string(),
    weight: z.number().positive().max(1),
  })).optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

/**
 * GET /v1/portfolio/benchmarks?activeOnly=true
 * List all benchmarks.
 */
router.get("/portfolio/benchmarks", async (req, res) => {
  const activeOnly = req.query["activeOnly"] === "true";
  const benchmarks = await listBenchmarks(activeOnly);
  res.json({ data: benchmarks, total: benchmarks.length });
});

/**
 * GET /v1/portfolio/benchmarks/:id
 * Get a specific benchmark with recent snapshots.
 */
router.get("/portfolio/benchmarks/:id", async (req, res) => {
  const { id } = req.params;
  const benchmark = await getBenchmark(id);
  if (!benchmark) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Benchmark not found: ${id}` } });
    return;
  }

  const limitStr = req.query["snapshotLimit"] as string | undefined;
  const snapshotLimit = limitStr ? Math.min(parseInt(limitStr, 10) || 30, 365) : 30;
  const snapshots = await listBenchmarkSnapshots(id, snapshotLimit);

  res.json({ benchmark, snapshots });
});

/**
 * POST /v1/portfolio/benchmarks
 * Create a custom benchmark.
 */
router.post("/portfolio/benchmarks", async (req, res) => {
  const parse = CreateBenchmarkSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const benchmark = await createBenchmark({
    ...parse.data,
    basketComposition: parse.data.basketComposition ?? null,
    symbol: parse.data.symbol ?? null,
    description: parse.data.description ?? null,
  });

  await appendAnalyticsAuditLog({
    actor: "api",
    action: "benchmark.create",
    entityType: "benchmark",
    entityId: benchmark.id,
    result: "success",
    payload: { name: benchmark.name, type: benchmark.benchmarkType },
  });

  res.status(201).json({ benchmark });
});

/**
 * POST /v1/portfolio/benchmarks/refresh
 * Trigger benchmark snapshot refresh.
 */
router.post("/portfolio/benchmarks/refresh", async (req, res) => {
  try {
    await refreshBenchmarkSnapshots();
    res.json({ message: "Benchmark snapshots refreshed" });
  } catch (err) {
    res.status(500).json({ error: { code: "REFRESH_ERROR", message: "Failed to refresh benchmarks" } });
  }
});

export default router;
