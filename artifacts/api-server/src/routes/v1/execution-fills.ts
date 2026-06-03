import { Router } from "express";
import { listFills } from "../../services/execution-db";

/**
 * execution-fills.ts — Fill history endpoint.
 *
 * GET /v1/execution/fills — list fills with symbol/time filters
 */

const router = Router();

router.get("/execution/fills", async (req, res) => {
  const { symbol, from, to, limit = "100" } = req.query as Record<string, string>;

  try {
    const fills = await listFills({
      symbol,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: Math.min(parseInt(limit) || 100, 500),
    });

    return res.json({ data: fills, count: fills.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list execution fills");
    return res.status(500).json({ error: "Failed to list fills" });
  }
});

export default router;
