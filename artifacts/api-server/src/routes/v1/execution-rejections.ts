import { Router } from "express";
import { listRejections } from "../../services/execution-db";

/**
 * execution-rejections.ts — Rejection log endpoint.
 *
 * GET /v1/execution/rejections — list order rejections with stage/symbol filters
 */

const router = Router();

router.get("/execution/rejections", async (req, res) => {
  const { symbol, stage, mode, limit = "50" } = req.query as Record<string, string>;

  try {
    const rejections = await listRejections({
      symbol,
      stage,
      mode,
      limit: Math.min(parseInt(limit) || 50, 200),
    });

    // Aggregate by stage
    const byStage: Record<string, number> = {};
    for (const r of rejections) {
      byStage[r.stage] = (byStage[r.stage] ?? 0) + 1;
    }

    return res.json({
      data: rejections,
      count: rejections.length,
      byStage,
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to list execution rejections");
    return res.status(500).json({ error: "Failed to list rejections" });
  }
});

export default router;
