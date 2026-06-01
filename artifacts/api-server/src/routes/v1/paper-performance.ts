import { Router, type IRouter } from "express";
import { getPaperAccount } from "../../services/paper-accounts-db";
import { computePaperPerformance } from "../../services/paper-performance";

const router: IRouter = Router();

/**
 * GET /v1/paper/performance
 * Get performance metrics for a paper trading account.
 *
 * Returns:
 *   - Time-windowed returns (daily, weekly, monthly, YTD)
 *   - Risk metrics (Sharpe, max drawdown)
 *   - Trade statistics (win rate, profit factor, avg trade, largest win/loss)
 */
router.get("/paper/performance", async (req, res) => {
  const { accountId } = req.query as Record<string, string | undefined>;

  if (!accountId) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "accountId query parameter is required" },
    });
    return;
  }

  const account = await getPaperAccount(accountId);
  if (!account) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Account not found: ${accountId}` } });
    return;
  }

  const metrics = await computePaperPerformance(accountId);
  if (!metrics) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to compute performance metrics" } });
    return;
  }

  res.json({ metrics });
});

export default router;
