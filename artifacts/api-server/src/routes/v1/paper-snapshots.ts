import { Router, type IRouter } from "express";
import { listDailySnapshots, getPaperAccount } from "../../services/paper-accounts-db";
import { snapshotAccount } from "../../services/paper-snapshot-service";

const router: IRouter = Router();

/**
 * GET /v1/paper/snapshots
 * List daily equity snapshots for a paper account.
 *
 * Returns snapshots in descending date order (most recent first).
 * Limit defaults to 90 (3 months). Max 365.
 */
router.get("/paper/snapshots", async (req, res) => {
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

  const limit = limitStr ? Math.min(parseInt(limitStr, 10), 365) : 90;
  if (isNaN(limit) || limit <= 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid limit" } });
    return;
  }

  const snapshots = await listDailySnapshots(accountId, { limit });
  res.json({ data: snapshots, total: snapshots.length });
});

/**
 * POST /v1/paper/snapshots/trigger
 * Manually trigger a snapshot for a specific account.
 * Useful for testing and on-demand snapshot generation.
 */
router.post("/paper/snapshots/trigger", async (req, res) => {
  const { accountId } = req.body as { accountId?: string };

  if (!accountId || typeof accountId !== "string") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "accountId is required" },
    });
    return;
  }

  const account = await getPaperAccount(accountId);
  if (!account) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Account not found: ${accountId}` } });
    return;
  }

  await snapshotAccount(accountId);

  const snapshots = await listDailySnapshots(accountId, { limit: 1 });
  res.json({ snapshot: snapshots[0] ?? null });
});

export default router;
