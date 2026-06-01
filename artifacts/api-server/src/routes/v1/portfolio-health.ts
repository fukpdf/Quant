import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getLatestHealthScore,
  listHealthScores,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { computeAndSaveHealthScore } from "../../services/health-engine";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/health?accountId=...&history=true&refresh=true
 * Returns portfolio health score and grade.
 * history=true returns up to 30 historical scores.
 * refresh=true forces recomputation.
 */
router.get("/portfolio/health", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const history = req.query["history"] === "true";
  const refresh = req.query["refresh"] === "true";
  const limitStr = req.query["limit"] as string | undefined;
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 30, 90) : 30;

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

  if (refresh) {
    try {
      await computeAndSaveHealthScore(accountId);
      await appendAnalyticsAuditLog({
        actor: "api",
        action: "health.refresh",
        accountId,
        result: "success",
      });
    } catch (err) {
      res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to recompute health score" } });
      return;
    }
  }

  if (history) {
    const scores = await listHealthScores(accountId, limit);
    res.json({ data: scores, total: scores.length });
    return;
  }

  let latest = await getLatestHealthScore(accountId);
  if (!latest) {
    // Compute on demand
    try {
      latest = await computeAndSaveHealthScore(accountId);
    } catch (err) {
      res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to compute health score" } });
      return;
    }
  }

  res.json({ data: latest });
});

export default router;
