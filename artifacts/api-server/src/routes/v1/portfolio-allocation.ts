import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  listAllocationSnapshots,
  getLatestAllocationSnapshot,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { computeAndSaveAllocation } from "../../services/allocation-tracker";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/allocation?accountId=...&history=true&limit=90
 * Returns current allocation analysis and optionally historical snapshots.
 */
router.get("/portfolio/allocation", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const history = req.query["history"] === "true";
  const refresh = req.query["refresh"] === "true";
  const limitStr = req.query["limit"] as string | undefined;
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 90, 365) : 90;

  if (!accountId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } });
    return;
  }

  const accountRows = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, accountId))
    .limit(1);
  if (!accountRows[0]) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Account not found: ${accountId}` } });
    return;
  }

  if (history) {
    const snapshots = await listAllocationSnapshots(accountId, limit);
    res.json({ data: snapshots, total: snapshots.length });
    return;
  }

  try {
    // Always compute current allocation (live view)
    const analysis = await computeAndSaveAllocation(accountId);
    await appendAnalyticsAuditLog({
      actor: "api",
      action: "allocation.compute",
      accountId,
      result: "success",
    });
    res.json({ data: analysis });
  } catch (err) {
    res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to compute allocation" } });
  }
});

export default router;
