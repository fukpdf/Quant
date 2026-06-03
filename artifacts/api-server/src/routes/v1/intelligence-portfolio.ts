import { Router } from "express";
import { z } from "zod/v4";
import {
  computeAndPersistAllocation,
  activatePortfolioAllocation,
  getActiveAllocation,
  listPortfolioAllocations,
  getPortfolioAllocationById,
} from "../../services/portfolio-allocator";
import { listAllocationHistory } from "../../services/intelligence-db";

/**
 * intelligence-portfolio.ts — Portfolio Allocation Construction endpoints.
 *
 * POST /v1/intelligence/portfolio/allocations           — compute new allocation
 * GET  /v1/intelligence/portfolio/allocations           — list allocations
 * GET  /v1/intelligence/portfolio/allocations/active    — get active allocation
 * GET  /v1/intelligence/portfolio/allocations/:id       — get allocation detail
 * POST /v1/intelligence/portfolio/allocations/:id/activate — activate allocation
 * GET  /v1/intelligence/portfolio/history               — allocation change history
 */

const router = Router();

const ComputeAllocationSchema = z.object({
  strategyNames: z.array(z.string().min(1)).min(1).max(20),
  method: z.enum(["equal_weight", "risk_parity", "volatility_targeting", "sharpe_maximization", "kelly"]),
  allocationName: z.string().max(100).optional(),
  constraints: z
    .object({
      minWeight: z.number().min(0).max(1).optional(),
      maxWeight: z.number().min(0).max(1).optional(),
      targetVolatility: z.number().min(0).max(2).optional(),
      kellyFraction: z.number().min(0.1).max(1).optional(),
      maxStrategies: z.number().int().min(1).optional(),
    })
    .optional()
    .default({}),
  regimeId: z.string().uuid().optional(),
});

const ActivateSchema = z.object({
  reason: z.enum(["rebalance", "regime_change", "optimization", "manual"]).optional().default("manual"),
  triggeredBy: z.string().max(50).optional().default("api"),
});

// POST /v1/intelligence/portfolio/allocations
router.post("/intelligence/portfolio/allocations", async (req, res) => {
  const parsed = ComputeAllocationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  const { strategyNames, method, constraints, allocationName, regimeId } = parsed.data;

  try {
    const allocation = await computeAndPersistAllocation(
      strategyNames,
      method,
      constraints ?? {},
      allocationName,
      regimeId,
    );
    return res.status(201).json({ data: allocation });
  } catch (err) {
    req.log?.error({ err }, "Failed to compute portfolio allocation");
    const msg = err instanceof Error ? err.message : "Allocation computation failed";
    return res.status(500).json({ error: msg });
  }
});

// GET /v1/intelligence/portfolio/allocations
router.get("/intelligence/portfolio/allocations", async (req, res) => {
  const method = typeof req.query.method === "string" ? req.query.method : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);

  try {
    const allocations = await listPortfolioAllocations({ method, status, limit });
    return res.json({ data: allocations, count: allocations.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list portfolio allocations");
    return res.status(500).json({ error: "Failed to list portfolio allocations" });
  }
});

// GET /v1/intelligence/portfolio/allocations/active
router.get("/intelligence/portfolio/allocations/active", async (req, res) => {
  try {
    const active = await getActiveAllocation();
    if (!active) return res.status(404).json({ error: "No active allocation found" });
    return res.json({ data: active });
  } catch (err) {
    req.log?.error({ err }, "Failed to get active allocation");
    return res.status(500).json({ error: "Failed to get active allocation" });
  }
});

// GET /v1/intelligence/portfolio/allocations/:id
router.get("/intelligence/portfolio/allocations/:id", async (req, res) => {
  try {
    const allocation = await getPortfolioAllocationById(req.params.id);
    if (!allocation) return res.status(404).json({ error: "Allocation not found" });
    return res.json({ data: allocation });
  } catch (err) {
    req.log?.error({ err }, "Failed to get portfolio allocation");
    return res.status(500).json({ error: "Failed to get portfolio allocation" });
  }
});

// POST /v1/intelligence/portfolio/allocations/:id/activate
router.post("/intelligence/portfolio/allocations/:id/activate", async (req, res) => {
  const parsed = ActivateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    const activated = await activatePortfolioAllocation(
      req.params.id,
      parsed.data.reason,
      parsed.data.triggeredBy,
    );
    if (!activated) return res.status(404).json({ error: "Allocation not found" });
    return res.json({ data: activated });
  } catch (err) {
    req.log?.error({ err }, "Failed to activate portfolio allocation");
    return res.status(500).json({ error: "Failed to activate portfolio allocation" });
  }
});

// GET /v1/intelligence/portfolio/history
router.get("/intelligence/portfolio/history", async (req, res) => {
  const allocationId = typeof req.query.allocation_id === "string" ? req.query.allocation_id : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);

  try {
    const history = await listAllocationHistory(allocationId, limit);
    return res.json({ data: history, count: history.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list allocation history");
    return res.status(500).json({ error: "Failed to list allocation history" });
  }
});

export default router;
