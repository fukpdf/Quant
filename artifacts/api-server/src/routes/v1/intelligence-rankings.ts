import { Router } from "express";
import { z } from "zod/v4";
import {
  computeAndPersistRankings,
  runAllRankings,
  listStrategyRankings,
  getLatestRankingsForPeriod,
} from "../../services/ranking-engine";
import type { RankingPeriod } from "../../services/intelligence-types";

/**
 * intelligence-rankings.ts — Multi-Factor Strategy Ranking endpoints.
 *
 * GET  /v1/intelligence/rankings              — list ranking records
 * GET  /v1/intelligence/rankings/latest       — latest rankings for a period
 * POST /v1/intelligence/rankings/compute      — trigger ranking computation
 */

const router = Router();

const ComputeRankingsSchema = z.object({
  period: z.enum(["daily", "weekly", "monthly", "all_time"]).optional().default("all_time"),
  all: z.boolean().optional().default(false),
});

// GET /v1/intelligence/rankings
router.get("/intelligence/rankings", async (req, res) => {
  const period = typeof req.query.period === "string" ? req.query.period : undefined;
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const rankings = await listStrategyRankings({ period, symbol, limit, offset });
    return res.json({ data: rankings, count: rankings.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list strategy rankings");
    return res.status(500).json({ error: "Failed to list strategy rankings" });
  }
});

// GET /v1/intelligence/rankings/latest
router.get("/intelligence/rankings/latest", async (req, res) => {
  const period = (req.query.period as RankingPeriod) || "all_time";
  const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 100);

  try {
    const rankings = await getLatestRankingsForPeriod(period, limit);
    return res.json({ data: rankings, count: rankings.length, period });
  } catch (err) {
    req.log?.error({ err }, "Failed to get latest rankings");
    return res.status(500).json({ error: "Failed to get latest rankings" });
  }
});

// POST /v1/intelligence/rankings/compute
router.post("/intelligence/rankings/compute", async (req, res) => {
  const parsed = ComputeRankingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    if (parsed.data.all) {
      const summary = await runAllRankings();
      return res.status(201).json({ data: summary, message: "All ranking periods computed" });
    }
    const result = await computeAndPersistRankings(parsed.data.period as RankingPeriod);
    return res.status(201).json({ data: result });
  } catch (err) {
    req.log?.error({ err }, "Failed to compute rankings");
    return res.status(500).json({ error: "Failed to compute rankings" });
  }
});

export default router;
