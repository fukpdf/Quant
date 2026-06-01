import { Router, type IRouter } from "express";
import { z } from "zod";
import { listBacktestRuns } from "../../services/research-db";

const router: IRouter = Router();

const QuerySchema = z.object({
  strategyName: z.string().optional(),
  symbol: z.string().optional(),
  status: z.enum(["pending", "running", "completed", "failed"]).optional(),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? Math.min(parseInt(v, 10), 100) : 50))
    .pipe(z.number().int().min(1).max(100)),
});

/**
 * GET /v1/research/runs
 * List backtest runs with optional filters.
 */
router.get("/research/runs", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const runs = await listBacktestRuns(parse.data);
  res.json({ data: runs, total: runs.length });
});

export default router;
