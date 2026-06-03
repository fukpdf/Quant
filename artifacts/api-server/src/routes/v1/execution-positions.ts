import { Router } from "express";
import { listPositions } from "../../services/execution-db";

/**
 * execution-positions.ts — Position tracking endpoint.
 *
 * GET /v1/execution/positions — list open/closed positions
 */

const router = Router();

router.get("/execution/positions", async (req, res) => {
  const { accountId, status, symbol, mode, limit = "100" } = req.query as Record<string, string>;

  try {
    const positions = await listPositions({
      accountId,
      status,
      symbol,
      mode,
      limit: Math.min(parseInt(limit) || 100, 500),
    });

    // Compute summary totals
    const open = positions.filter((p) => p.status === "open");
    const closed = positions.filter((p) => p.status === "closed");

    const totalUnrealizedPnl = open.reduce(
      (sum, p) => sum + parseFloat(p.unrealizedPnl as string ?? "0"),
      0,
    );
    const totalRealizedPnl = closed.reduce(
      (sum, p) => sum + parseFloat(p.realizedPnl as string ?? "0"),
      0,
    );

    return res.json({
      data: positions,
      count: positions.length,
      summary: {
        openPositions: open.length,
        closedPositions: closed.length,
        totalUnrealizedPnl: totalUnrealizedPnl.toFixed(8),
        totalRealizedPnl: totalRealizedPnl.toFixed(8),
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to list execution positions");
    return res.status(500).json({ error: "Failed to list positions" });
  }
});

export default router;
