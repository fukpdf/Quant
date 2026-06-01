import { Router } from "express";
import { getLatestOrderbook } from "../../services/stream-db";
import { getMarketState } from "../../services/market-state-engine";

const router = Router();

/**
 * GET /v1/orderbook — retrieve current order book for a symbol.
 *
 * Returns:
 *   - Latest stored order book snapshot (from DB)
 *   - Current imbalance from in-memory market state engine
 *
 * Query params:
 *   symbol (required)
 */
router.get("/orderbook", async (req, res) => {
  try {
    const { symbol } = req.query as { symbol?: string };

    if (!symbol) {
      return res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "symbol query parameter is required" },
      });
    }

    const [orderbook, state] = await Promise.all([
      getLatestOrderbook(symbol),
      Promise.resolve(getMarketState(symbol)),
    ]);

    if (!orderbook) {
      return res.status(404).json({
        error: { code: "NOT_FOUND", message: `No order book data found for ${symbol}` },
      });
    }

    res.json({
      data: {
        ...orderbook,
        // Augment with live state if available
        liveImbalance: state?.imbalance ?? null,
        liveBid: state?.bidPrice ?? null,
        liveAsk: state?.askPrice ?? null,
      },
      symbol,
    });
  } catch (err) {
    req.log?.error({ err }, "GET /orderbook failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch order book" } });
  }
});

export default router;
