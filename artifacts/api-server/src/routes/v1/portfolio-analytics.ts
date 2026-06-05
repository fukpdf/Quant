import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  getLatestPortfolioAnalytics,
  upsertPortfolioAnalytics,
  getDefaultBenchmark,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { computeAndSavePerformance } from "../../services/performance-engine";
import { computeAndSaveHealthScore } from "../../services/health-engine";
import { computeAndSaveAllocation } from "../../services/allocation-tracker";
import { computeDiversificationAnalysis } from "../../services/diversification-engine";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/analytics?accountId=...
 * Returns the latest analytics snapshot for an account.
 * If no snapshot exists, computes one on demand.
 */
router.get("/portfolio/analytics", async (req, res) => {
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

  let snapshot = await getLatestPortfolioAnalytics(accountId);

  // Compute on demand if no snapshot exists
  if (!snapshot) {
    try {
      const defaultBenchmark = await getDefaultBenchmark();
      const [performance, health, allocation, diversification] = await Promise.all([
        computeAndSavePerformance(accountId, defaultBenchmark?.id).catch(() => null),
        computeAndSaveHealthScore(accountId).catch(() => null),
        computeAndSaveAllocation(accountId).catch(() => null),
        computeDiversificationAnalysis(accountId).catch(() => null),
      ]);

      snapshot = await upsertPortfolioAnalytics({
        accountId,
        snapshotAt: new Date(),
        healthScore: health ? String(health.overallScore) : null,
        healthGrade: health?.grade ?? null,
        diversificationScore: diversification ? String(diversification.overallDiversificationScore) : null,
        openPositions: allocation?.activePositionCount ?? 0,
        activeStrategies: allocation?.activeStrategyCount ?? 0,
        currentEquity: String(accountRows[0].currentEquity),
        cashBalance: String(accountRows[0].cashBalance),
      });

      await appendAnalyticsAuditLog({
        actor: "api",
        action: "analytics.on_demand_compute",
        accountId,
        result: "success",
      });
    } catch (err) {
      res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to compute analytics" } });
      return;
    }
  }

  res.json({ data: snapshot });
});

export default router;
