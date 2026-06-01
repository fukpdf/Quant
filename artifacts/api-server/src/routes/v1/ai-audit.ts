import { Router, type IRouter } from "express";
import { listAiAuditLog } from "../../services/ai-db";

const router: IRouter = Router();

/**
 * GET /v1/ai/audit-log
 * Retrieve the immutable AI system audit log.
 * Every AI interaction (chat query, report generation, insight generation, analysis) is recorded here.
 *
 * The audit log includes: prompt, response summary, context sources, provider, model, token usage,
 * latency, result status, and timestamp — enabling full auditability of AI usage.
 */
router.get("/ai/audit-log", async (req, res) => {
  const { action, accountId, actor, result, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 200;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–1000" } });
    return;
  }

  const entries = await listAiAuditLog({ action, accountId, actor, result, limit: parsedLimit });
  res.json({ data: entries, total: entries.length });
});

export default router;
