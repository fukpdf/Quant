import { Router, type IRouter } from "express";
import { z } from "zod";
import { listDataQualityChecks } from "../../services/data-quality";

const router: IRouter = Router();

const CHECK_TYPES = [
  "missing_candles",
  "timestamp_gaps",
  "duplicate_candles",
  "outlier_prices",
  "invalid_volumes",
  "future_timestamps",
  "ohlc_consistency",
] as const;

const QuerySchema = z.object({
  symbol: z.string().min(1).max(30).optional(),
  interval: z.string().max(10).optional(),
  checkType: z.enum(CHECK_TYPES).optional(),
  status: z.enum(["pass", "fail", "warning"]).optional(),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

router.get("/data-quality", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const checks = await listDataQualityChecks(parse.data);
  res.json({ data: checks, total: checks.length });
});

export default router;
