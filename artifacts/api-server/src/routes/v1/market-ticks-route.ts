import { Router } from "express";
import { getRecentTicks, getTicksInRange } from "../../services/stream-db";

const router = Router();

/**
 * GET /v1/ticks — retrieve recent tick data.
 *
 * Query params:
 *   symbol   (required) — e.g. BTCUSDT
 *   limit    (optional, default 100, max 1000)
 *   from     (optional) — ISO timestamp
 *   to       (optional) — ISO timestamp
 */
router.get("/ticks", async (req, res) => {
  try {
    const { symbol, from, to } = req.query as {
      symbol?: string;
      from?: string;
      to?: string;
    };

    if (!symbol) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "symbol query parameter is required" },
      });
    }

    const limit = Math.min(Number(req.query["limit"] ?? 100), 1000);

    let ticks;
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return res.status(400).json({
          error: { code: "VALIDATION_ERROR", message: "Invalid from/to date format. Use ISO 8601." },
        });
      }
      ticks = await getTicksInRange(symbol, fromDate, toDate);
    } else {
      ticks = await getRecentTicks(symbol, limit);
    }

    res.json({
      data: ticks,
      symbol,
      count: ticks.length,
    });
  } catch (err) {
    req.log?.error({ err }, "GET /ticks failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch ticks" } });
  }
});

export default router;
