import { Router, type IRouter } from "express";
import { generateInsights } from "../../services/ai-analysis-service";
import { listInsights, acknowledgeInsight } from "../../services/ai-db";

const router: IRouter = Router();

/**
 * GET /v1/ai/insights
 * List stored AI-generated insights.
 * Supports filtering by account, category, severity, and acknowledgement status.
 */
router.get("/ai/insights", async (req, res) => {
  const { accountId, category, severity, acknowledged, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 100;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–500" } });
    return;
  }

  let parsedAcknowledged: boolean | undefined;
  if (acknowledged === "true") parsedAcknowledged = true;
  else if (acknowledged === "false") parsedAcknowledged = false;

  const insights = await listInsights({
    accountId,
    category,
    severity,
    acknowledged: parsedAcknowledged,
    limit: parsedLimit,
  });

  res.json({ data: insights, total: insights.length });
});

/**
 * POST /v1/ai/insights/generate
 * Trigger AI insight generation from current platform data.
 * Returns the count of new insights created.
 */
router.post("/ai/insights/generate", async (req, res) => {
  const { accountId, domains } = req.body as Record<string, unknown>;

  try {
    const count = await generateInsights({
      accountId: typeof accountId === "string" ? accountId : undefined,
      domains: Array.isArray(domains) ? domains : undefined,
    });

    res.status(201).json({ data: { insightsCreated: count } });
  } catch (err) {
    req.log?.error({ err }, "Insight generation error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

/**
 * PATCH /v1/ai/insights/:id/acknowledge
 * Mark an insight as acknowledged by the operator.
 */
router.patch("/ai/insights/:id/acknowledge", async (req, res) => {
  try {
    await acknowledgeInsight(req.params.id);
    res.json({ data: { acknowledged: true } });
  } catch (err) {
    req.log?.error({ err }, "Insight acknowledge error");
    res.status(500).json({ error: { code: "SERVER_ERROR", message: String(err) } });
  }
});

export default router;
