import { Router, type IRouter } from "express";
import { listPaperFills, getPaperAccount } from "../../services/paper-accounts-db";

const router: IRouter = Router();

/**
 * GET /v1/paper/fills
 * List paper fill records for an account.
 */
router.get("/paper/fills", async (req, res) => {
  const { accountId, limit: limitStr } = req.query as Record<string, string | undefined>;

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

  const limit = limitStr ? Math.min(parseInt(limitStr, 10), 500) : 100;
  if (isNaN(limit) || limit <= 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid limit" } });
    return;
  }

  const fills = await listPaperFills(accountId, { limit });
  res.json({ data: fills, total: fills.length });
});

export default router;
