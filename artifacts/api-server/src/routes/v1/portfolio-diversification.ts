import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeDiversificationAnalysis } from "../../services/diversification-engine";
import { appendAnalyticsAuditLog } from "../../services/analytics-db";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/diversification?accountId=...
 * Returns diversification analysis for a portfolio account.
 */
router.get("/portfolio/diversification", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;

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

  try {
    const analysis = await computeDiversificationAnalysis(accountId);
    await appendAnalyticsAuditLog({
      actor: "api",
      action: "diversification.compute",
      accountId,
      result: "success",
    });
    res.json({ data: analysis });
  } catch (err) {
    res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to compute diversification analysis" } });
  }
});

export default router;
