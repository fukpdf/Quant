import { Router, type IRouter } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { paperAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  listPortfolioAttributions,
  getLatestPortfolioAttribution,
  listStrategyAttributions,
  listAssetAttributions,
  appendAnalyticsAuditLog,
} from "../../services/analytics-db";
import { computeAndSaveAttribution } from "../../services/attribution-engine";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/attribution?accountId=...&refresh=true
 * Returns top-level return attribution for the account.
 */
router.get("/portfolio/attribution", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const refresh = req.query["refresh"] === "true";
  const limitStr = req.query["limit"] as string | undefined;
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 10, 50) : 10;

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
      await computeAndSaveAttribution(accountId);
      await appendAnalyticsAuditLog({
        actor: "api",
        action: "attribution.refresh",
        accountId,
        result: "success",
      });
    } catch (err) {
      res.status(500).json({ error: { code: "COMPUTE_ERROR", message: "Failed to recompute attribution" } });
      return;
    }
  }

  let attributions = await listPortfolioAttributions(accountId, limit);

  // Compute on demand if none exist
  if (attributions.length === 0) {
    try {
      const result = await computeAndSaveAttribution(accountId);
      attributions = [result.attribution];
    } catch (_) {
      res.json({ data: [], total: 0 });
      return;
    }
  }

  res.json({ data: attributions, total: attributions.length });
});

/**
 * GET /v1/portfolio/attribution/strategies?accountId=...&attributionId=...
 * Returns per-strategy attribution breakdown.
 */
router.get("/portfolio/attribution/strategies", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const attributionId = req.query["attributionId"] as string | undefined;

  if (!accountId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } });
    return;
  }

  // If no attributionId provided, use the latest
  let resolvedAttributionId = attributionId;
  if (!resolvedAttributionId) {
    const latest = await getLatestPortfolioAttribution(accountId);
    if (!latest) {
      // Compute on demand
      try {
        const result = await computeAndSaveAttribution(accountId);
        resolvedAttributionId = result.attribution.id;
      } catch (_) {
        res.json({ data: [], total: 0 });
        return;
      }
    } else {
      resolvedAttributionId = latest.id;
    }
  }

  const rows = await listStrategyAttributions(accountId, resolvedAttributionId);
  res.json({ data: rows, total: rows.length });
});

/**
 * GET /v1/portfolio/attribution/assets?accountId=...&attributionId=...
 * Returns per-asset attribution breakdown.
 */
router.get("/portfolio/attribution/assets", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const attributionId = req.query["attributionId"] as string | undefined;

  if (!accountId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } });
    return;
  }

  let resolvedAttributionId = attributionId;
  if (!resolvedAttributionId) {
    const latest = await getLatestPortfolioAttribution(accountId);
    if (!latest) {
      try {
        const result = await computeAndSaveAttribution(accountId);
        resolvedAttributionId = result.attribution.id;
      } catch (_) {
        res.json({ data: [], total: 0 });
        return;
      }
    } else {
      resolvedAttributionId = latest.id;
    }
  }

  const rows = await listAssetAttributions(accountId, resolvedAttributionId);
  res.json({ data: rows, total: rows.length });
});

export default router;
