import { Router, type IRouter } from "express";
import { z } from "zod";
import { getRankings } from "../../services/phase4-db";

const router: IRouter = Router();

const GetRankingsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

/**
 * GET /v1/research/rankings
 * Returns completed backtest runs ranked by Sharpe Ratio (desc),
 * then by Total Return (desc) as a tiebreaker.
 * Includes full performance metrics for each ranked run.
 */
router.get("/research/rankings", async (req, res) => {
  const parseQ = GetRankingsQuery.safeParse(req.query);
  if (!parseQ.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parseQ.error.message },
    });
    return;
  }

  const { limit } = parseQ.data;
  const rankings = await getRankings(limit);

  res.json({ data: rankings, total: rankings.length });
});

export default router;
