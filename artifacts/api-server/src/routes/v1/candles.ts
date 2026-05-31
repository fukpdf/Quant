import { Router, type IRouter } from "express";
import { z } from "zod";
import { queryCandles } from "../../services/market-data";

const router: IRouter = Router();

const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

const QuerySchema = z.object({
  symbol: z.string().min(1).max(30).toUpperCase(),
  interval: z.enum(VALID_INTERVALS),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? Math.min(parseInt(v, 10), 500) : 100))
    .pipe(z.number().int().min(1).max(500)),
  startTime: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? new Date(v) : undefined)),
  endTime: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? new Date(v) : undefined)),
});

router.get("/candles", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { symbol, interval, limit, startTime, endTime } = parse.data;

  const candles = await queryCandles({ symbol, interval, limit, startTime, endTime });

  res.json({
    data: candles,
    total: candles.length,
    symbol,
    interval,
  });
});

export default router;
