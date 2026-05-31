import { Router, type IRouter } from "express";
import { z } from "zod";
import { getLatestCandle } from "../../services/market-data";

const router: IRouter = Router();

const QuerySchema = z.object({
  symbol: z.string().min(1).max(30).toUpperCase(),
});

router.get("/latest-price", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const candle = await getLatestCandle(parse.data.symbol);

  if (!candle) {
    res.status(404).json({
      error: {
        code: "SYMBOL_NOT_FOUND",
        message: `No candle data found for symbol: ${parse.data.symbol}`,
      },
    });
    return;
  }

  res.json({
    symbol: candle.symbol,
    price: candle.close,
    timestamp: candle.timestamp,
    interval: candle.interval,
    source: candle.source,
  });
});

export default router;
