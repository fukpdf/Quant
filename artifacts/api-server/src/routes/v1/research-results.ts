import { Router, type IRouter } from "express";
import { z } from "zod";
import { listPerformanceResults } from "../../services/research-db";

const router: IRouter = Router();

const QuerySchema = z.object({
  strategyName: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? Math.min(parseInt(v, 10), 100) : 50))
    .pipe(z.number().int().min(1).max(100)),
});

/**
 * GET /v1/research/results
 * Returns performance metrics for completed backtest runs,
 * joined with their run metadata.
 */
router.get("/research/results", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const results = await listPerformanceResults(parse.data);
  res.json({ data: results, total: results.length });
});

export default router;
