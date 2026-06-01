import { Router, type IRouter } from "express";
import { listRiskDecisions } from "../../services/risk-db";

const router: IRouter = Router();

/**
 * GET /v1/risk/decisions
 * List pre-trade risk decisions with optional filters.
 */
router.get("/risk/decisions", async (req, res) => {
  const { accountId, decision, strategyName, limit } = req.query as Record<string, string | undefined>;

  const VALID_DECISIONS = ["approved", "rejected", "requires_review"];
  if (decision && !VALID_DECISIONS.includes(decision)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid decision. Must be one of: ${VALID_DECISIONS.join(", ")}`,
      },
    });
    return;
  }

  const parsedLimit = limit ? parseInt(limit, 10) : 100;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–1000" } });
    return;
  }

  const decisions = await listRiskDecisions({
    accountId,
    decision,
    strategyName,
    limit: parsedLimit,
  });

  res.json({ data: decisions, total: decisions.length });
});

export default router;
