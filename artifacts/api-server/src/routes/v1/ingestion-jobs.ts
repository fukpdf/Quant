import { Router, type IRouter } from "express";
import { z } from "zod";
import { listIngestionJobs } from "../../services/ingestion-jobs";

const router: IRouter = Router();

const QuerySchema = z.object({
  provider: z.string().optional(),
  symbol: z.string().max(30).optional(),
  status: z
    .enum(["pending", "running", "success", "failed", "partial"])
    .optional(),
  jobType: z
    .enum([
      "candle_backfill",
      "candle_incremental",
      "quality_check",
      "provider_health",
    ])
    .optional(),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

router.get("/ingestion/jobs", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { provider, symbol, status, jobType, limit } = parse.data;

  const jobs = await listIngestionJobs({
    providerName: provider,
    symbol,
    status,
    jobType,
    limit,
  });

  res.json({ data: jobs, total: jobs.length });
});

export default router;
