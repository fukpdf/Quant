import { Router, type IRouter } from "express";
import { getPaperAccount, getPaperPortfolio, getOpenPositions } from "../../services/paper-accounts-db";
import { refreshPortfolio } from "../../services/paper-portfolio-tracker";

const router: IRouter = Router();

/**
 * GET /v1/paper/portfolio
 * Get the portfolio summary for a paper account.
 * Includes account state, portfolio metrics, and open position list.
 */
router.get("/paper/portfolio", async (req, res) => {
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

  // Refresh portfolio metrics before returning
  const [portfolio, openPositions] = await Promise.all([
    refreshPortfolio(accountId),
    getOpenPositions(accountId),
  ]);

  res.json({
    account,
    portfolio,
    openPositions,
    openPositionCount: openPositions.length,
  });
});

export default router;
