import { Router } from "express";
import {
  getMarketState,
  getAllMarketStates,
  getTrackedSymbols,
} from "../../services/market-state-engine";
import { getLatestMarketState } from "../../services/stream-db";

const router = Router();

/**
 * GET /v1/market-state — current market state per symbol.
 *
 * Priority: in-memory state (always most current) → DB snapshot (if offline)
 *
 * Query params:
 *   symbol  (optional) — filter to a single symbol
 *   source  (optional) — "live" (default) | "snapshot" (DB snapshots)
 */
router.get("/market-state", async (req, res): Promise<void> => {
  try {
    const { symbol, source } = req.query as { symbol?: string; source?: string };

    if (source === "snapshot") {
      // Return DB snapshots
      const snapshots = await getLatestMarketState(symbol);
      return void res.json({
        data: Array.isArray(snapshots) ? snapshots : [snapshots].filter(Boolean),
        source: "snapshot",
      });
    }

    // Return live in-memory state
    if (symbol) {
      const state = getMarketState(symbol);
      if (!state) {
        // Fallback to DB snapshot
        const snapshot = await getLatestMarketState(symbol);
        if (!snapshot) {
          return void res.status(404).json({
            error: {
              code: "NOT_FOUND",
              message: `No market state available for ${symbol}. Is streaming active?`,
            },
          });
        }
        return void res.json({ data: snapshot, source: "snapshot" });
      }
      return void res.json({ data: state, source: "live" });
    }

    const allStates = getAllMarketStates();
    if (allStates.length === 0) {
      // Fallback: return DB snapshots
      const snapshots = await getLatestMarketState();
      return void res.json({
        data: Array.isArray(snapshots) ? snapshots : [],
        source: "snapshot",
      });
    }

    res.json({
      data: allStates,
      source: "live",
      symbols: getTrackedSymbols(),
    });
  } catch (err) {
    req.log?.error({ err }, "GET /market-state failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get market state" } });
  }
});

export default router;
