import { Router, type IRouter } from "express";
import { analyzePortfolio, analyzeStrategy, analyzeRisk } from "../../services/ai-analysis-service";
import { listSummaries } from "../../services/ai-db";

const router: IRouter = Router();

/**
 * GET /v1/ai/summaries
 * List AI-generated domain summaries.
 */
router.get("/ai/summaries", async (req, res) => {
  const { accountId, domain, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 20;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–100" } });
    return;
  }

  const summaries = await listSummaries({ accountId, domain, limit: parsedLimit });
  res.json({ data: summaries, total: summaries.length });
});

/**
 * POST /v1/ai/summaries/portfolio
 * Generate a portfolio analysis summary for an account.
 */
router.post("/ai/summaries/portfolio", async (req, res) => {
  const { accountId, domains } = req.body as Record<string, unknown>;

  if (!accountId || typeof accountId !== "string") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } });
    return;
  }

  try {
    const content = await analyzePortfolio({
      accountId,
      domains: Array.isArray(domains) ? domains : undefined,
    });
    res.status(201).json({ data: { content } });
  } catch (err) {
    req.log?.error({ err }, "Portfolio analysis error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

/**
 * POST /v1/ai/summaries/strategy
 * Generate a strategy analysis summary.
 */
router.post("/ai/summaries/strategy", async (req, res) => {
  const { strategyName, backtestRunId, accountId } = req.body as Record<string, unknown>;

  if (!strategyName || typeof strategyName !== "string") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "strategyName is required" } });
    return;
  }

  try {
    const content = await analyzeStrategy({
      strategyName,
      backtestRunId: typeof backtestRunId === "string" ? backtestRunId : undefined,
      accountId: typeof accountId === "string" ? accountId : undefined,
    });
    res.status(201).json({ data: { content } });
  } catch (err) {
    req.log?.error({ err }, "Strategy analysis error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

/**
 * POST /v1/ai/summaries/risk
 * Generate a risk situation analysis.
 */
router.post("/ai/summaries/risk", async (req, res) => {
  const { accountId, focusEventId, focusEventType } = req.body as Record<string, unknown>;

  try {
    const content = await analyzeRisk({
      accountId: typeof accountId === "string" ? accountId : undefined,
      focusEventId: typeof focusEventId === "string" ? focusEventId : undefined,
      focusEventType: typeof focusEventType === "string" ? focusEventType : undefined,
    });
    res.status(201).json({ data: { content } });
  } catch (err) {
    req.log?.error({ err }, "Risk analysis error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

export default router;
