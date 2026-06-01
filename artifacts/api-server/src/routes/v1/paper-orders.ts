import { Router, type IRouter } from "express";
import { z } from "zod";
import { listPaperOrders, getPaperAccount } from "../../services/paper-accounts-db";

const router: IRouter = Router();

const VALID_STATUSES = [
  "pending", "submitted", "partially_filled",
  "filled", "cancelled", "rejected", "expired",
];

/**
 * GET /v1/paper/orders
 * List paper orders for an account, optionally filtered by status.
 */
router.get("/paper/orders", async (req, res) => {
  const { accountId, status, limit: limitStr } = req.query as Record<string, string | undefined>;

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

  if (status && !VALID_STATUSES.includes(status)) {
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

  const orders = await listPaperOrders(accountId, { status, limit });
  res.json({ data: orders, total: orders.length });
});

export default router;
