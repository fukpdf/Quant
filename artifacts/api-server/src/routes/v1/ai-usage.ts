import { Router, type IRouter } from "express";
import { listUsageMetrics, getUsageSummary } from "../../services/ai-db";
import { AiProviderFactory } from "../../services/ai-provider-factory";

const router: IRouter = Router();

/**
 * GET /v1/ai/usage
 * Retrieve AI token usage metrics and cost tracking.
 * Supports aggregate summary view and per-call detail list.
 */
router.get("/ai/usage", async (req, res) => {
  const { provider, operationType, limit, summary } = req.query as Record<string, string | undefined>;

  if (summary === "true") {
    const agg = await getUsageSummary();
    res.json({
      data: {
        ...agg,
        activeProvider: AiProviderFactory.getProviderName(),
      },
    });
    return;
  }

  const parsedLimit = limit ? parseInt(limit, 10) : 200;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–1000" } });
    return;
  }

  const metrics = await listUsageMetrics({ provider, operationType, limit: parsedLimit });
  res.json({ data: metrics, total: metrics.length });
});

/**
 * GET /v1/ai/usage/summary
 * Get aggregated usage summary per provider.
 */
router.get("/ai/usage/summary", async (_req, res) => {
  const agg = await getUsageSummary();
  res.json({
    data: {
      ...agg,
      activeProvider: AiProviderFactory.getProviderName(),
    },
  });
});

export default router;
