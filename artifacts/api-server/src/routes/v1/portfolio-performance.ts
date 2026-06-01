import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  listPortfolioPerformance,
  getLatestPerformanceByPeriod,
  listPerformancePeriods,
  getDefaultBenchmark,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { computeAndSavePerformance } from "../../services/performance-engine";

const router: IRouter = Router();

const VALID_PERIODS = [
  "cumulative", "ytd", "rolling_7d", "rolling_30d", "rolling_90d",
  "daily", "weekly", "monthly", "quarterly", "yearly",
] as const;

/**
 * GET /v1/portfolio/performance?accountId=...&period=...&refresh=true
 * Returns portfolio performance metrics.
 * Optional period filter; refresh=true forces recomputation.
 */
router.get("/portfolio/performance", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const period = req.query["period"] as string | undefined;
  const periodType = req.query["periodType"] as string | undefined;
  const refresh = req.query["refresh"] === "true";

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

  // Optionally recompute
  if (refresh) {
    try {
      const defaultBenchmark = await getDefaultBenchmark();
      await computeAndSavePerformance(accountId, defaultBenchmark?.id);
      await appendAnalyticsAuditLog({
        actor: "api",
        action: "performance.refresh",
        accountId,
        result: "success",
      });
    } catch (err) {
      res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to recompute performance" } });
      return;
    }
  }

  if (periodType) {
    // Return calendar period rows (monthly/yearly table)
    const periods = await listPerformancePeriods(accountId, periodType);
    res.json({ data: periods, total: periods.length });
    return;
  }

  // Return performance period records
  const records = await listPortfolioPerformance(accountId, period);
  res.json({ data: records, total: records.length });
});

export default router;
