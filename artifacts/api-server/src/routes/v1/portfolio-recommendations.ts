import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  listRecommendations,
  acknowledgeRecommendation,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { computeDiversificationAnalysis } from "../../services/diversification-engine";
import { computeAndSaveAllocation } from "../../services/allocation-tracker";
import { computeAndSaveHealthScore } from "../../services/health-engine";
import { generateAndSaveRecommendations } from "../../services/recommendation-engine";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/recommendations?accountId=...&unacknowledgedOnly=true&priority=high
 * Returns rule-based recommendations for the portfolio.
 */
router.get("/portfolio/recommendations", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const unacknowledgedOnly = req.query["unacknowledgedOnly"] === "true";
  const priority = req.query["priority"] as string | undefined;
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

  if (refresh) {
    try {
      const [diversification, allocation, health] = await Promise.all([
        computeDiversificationAnalysis(accountId),
        computeAndSaveAllocation(accountId),
        computeAndSaveHealthScore(accountId),
      ]);
      await generateAndSaveRecommendations({
        accountId,
        health: {
          overallScore: parseFloat(health.overallScore),
          grade: health.grade,
          details: (health.details as Record<string, unknown>) ?? {},
        },
        diversification,
        allocation,
      });
    } catch (err) {
      res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to generate recommendations" } });
      return;
    }
  }

  const recommendations = await listRecommendations(accountId, { unacknowledgedOnly, priority });
  res.json({ data: recommendations, total: recommendations.length });
});

/**
 * POST /v1/portfolio/recommendations/:id/acknowledge
 * Acknowledge a recommendation.
 */
router.post("/portfolio/recommendations/:id/acknowledge", async (req, res) => {
  const { id } = req.params;
  const updated = await acknowledgeRecommendation(id);
  if (!updated) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Recommendation not found: ${id}` } });
    return;
  }
  await appendAnalyticsAuditLog({
    actor: "api",
    action: "recommendation.acknowledge",
    entityType: "recommendation",
    entityId: id,
    result: "success",
  });
  res.json({ recommendation: updated });
});

export default router;
