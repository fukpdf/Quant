import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  strategyAttributionTable,
  assetAttributionTable,
  paperAccountsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { getLatestPortfolioAttribution } from "../../services/analytics-db";
import { computeAndSaveAttribution } from "../../services/attribution-engine";

const router: IRouter = Router();

/**
 * GET /v1/portfolio/rankings?accountId=...&type=strategy|asset
 * Returns strategy or asset rankings by contribution.
 */
router.get("/portfolio/rankings", async (req, res) => {
  const accountId = req.query["accountId"] as string | undefined;
  const type = (req.query["type"] as string) || "strategy";
  const limitStr = req.query["limit"] as string | undefined;
  const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 10, 50) : 10;

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!accountId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } });
    return;
  }

  if (!UUID_RE.test(accountId)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId must be a valid UUID" } });
    return;
  }

  if (type !== "strategy" && type !== "asset") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "type must be 'strategy' or 'asset'" } });
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

  // Get latest attribution id
  let attributionId: string | null = null;
  const latestAttribution = await getLatestPortfolioAttribution(accountId);
  if (latestAttribution) {
    attributionId = latestAttribution.id;
  } else {
    // Compute on demand
    try {
      const result = await computeAndSaveAttribution(accountId);
      attributionId = result.attribution.id;
    } catch (_) {
      res.json({ data: [], total: 0 });
      return;
    }
  }

  if (type === "strategy") {
    const rows = await db
      .select()
      .from(strategyAttributionTable)
      .where(and(
        eq(strategyAttributionTable.accountId, accountId),
        eq(strategyAttributionTable.attributionId, attributionId),
      ))
      .orderBy(strategyAttributionTable.rank)
      .limit(limit);

    res.json({
      type: "strategy",
      data: rows.map(r => ({
        rank: r.rank,
        strategyName: r.strategyName,
        pnlContribution: r.pnlContribution,
        returnContributionPct: r.returnContributionPct,
        capitalAllocationPct: r.capitalAllocationPct,
        sharpeContribution: r.sharpeContribution,
        winRatePct: r.winRatePct,
        tradeCount: r.tradeCount,
      })),
      total: rows.length,
    });
  } else {
    const rows = await db
      .select()
      .from(assetAttributionTable)
      .where(and(
        eq(assetAttributionTable.accountId, accountId),
        eq(assetAttributionTable.attributionId, attributionId),
      ))
      .orderBy(assetAttributionTable.rank)
      .limit(limit);

    res.json({
      type: "asset",
      data: rows.map(r => ({
        rank: r.rank,
        symbol: r.symbol,
        pnlContribution: r.pnlContribution,
        returnContributionPct: r.returnContributionPct,
        capitalAllocationPct: r.capitalAllocationPct,
        assetReturnPct: r.assetReturnPct,
        winRatePct: r.winRatePct,
        tradeCount: r.tradeCount,
      })),
      total: rows.length,
    });
  }
});

export default router;
