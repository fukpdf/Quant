import { Router, type IRouter } from "express";
import { runComparison } from "../../services/ai-analysis-service";

const router: IRouter = Router();

const VALID_COMPARISON_TYPES = [
  "strategy_vs_strategy",
  "portfolio_vs_benchmark",
  "backtest_vs_paper",
  "risk_profile_vs_risk_profile",
] as const;

/**
 * POST /v1/ai/compare
 * Generate a narrative comparison between two platform entities.
 *
 * Supported comparison types:
 * - strategy_vs_strategy: Compare two strategies by name
 * - portfolio_vs_benchmark: Compare portfolio vs. benchmark
 * - backtest_vs_paper: Compare backtest run vs. paper trading run
 * - risk_profile_vs_risk_profile: Compare two risk profile configurations
 *
 * Returns a markdown narrative with executive summary, analysis, and conclusion.
 */
router.post("/ai/compare", async (req, res) => {
  const { type, leftId, rightId, accountId } = req.body as Record<string, unknown>;

  if (!type || typeof type !== "string") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "type is required" } });
    return;
  }

  if (!VALID_COMPARISON_TYPES.includes(type as (typeof VALID_COMPARISON_TYPES)[number])) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `type must be one of: ${VALID_COMPARISON_TYPES.join(", ")}`,
      },
    });
    return;
  }

  if (!leftId || typeof leftId !== "string") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "leftId is required" } });
    return;
  }

  if (!rightId || typeof rightId !== "string") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "rightId is required" } });
    return;
  }

  try {
    const content = await runComparison({
      type: type as (typeof VALID_COMPARISON_TYPES)[number],
      leftId,
      rightId,
      accountId: typeof accountId === "string" ? accountId : undefined,
    });

    res.status(201).json({ data: { comparison: content, type, leftId, rightId } });
  } catch (err) {
    req.log?.error({ err }, "Comparison error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

export default router;
