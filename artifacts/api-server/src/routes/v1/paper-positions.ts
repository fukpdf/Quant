import { Router, type IRouter } from "express";
import { getAllPositions, getPaperAccount } from "../../services/paper-accounts-db";

const router: IRouter = Router();

/**
 * GET /v1/paper/positions
 * List paper positions for an account.
 * Defaults to open positions only. Pass status=closed for closed positions.
 * Pass status=all to get both.
 */
router.get("/paper/positions", async (req, res) => {
  const { accountId, status = "open", limit: limitStr } = req.query as Record<string, string | undefined>;

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

  const VALID_STATUSES = ["open", "closed", "all"];
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      },
    });
    return;
  }

  const limit = limitStr ? Math.min(parseInt(limitStr, 10), 500) : 100;
  if (isNaN(limit) || limit <= 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid limit" } });
    return;
  }

  const resolvedStatus = status === "all" ? undefined : status;
  const positions = await getAllPositions(accountId, { status: resolvedStatus, limit });

  res.json({ data: positions, total: positions.length });
});

export default router;
