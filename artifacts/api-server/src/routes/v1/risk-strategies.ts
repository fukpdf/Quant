import { Router, type IRouter } from "express";
import { listStrategyRiskScores, getLatestStrategyRiskScore } from "../../services/risk-db";
import { scoreStrategy, scoreAllStrategies } from "../../services/strategy-risk-scorer";

const router: IRouter = Router();

/**
 * GET /v1/risk/strategies
 * List latest risk scores for all strategies.
 */
router.get("/risk/strategies", async (req, res) => {
  const scores = await listStrategyRiskScores();
  res.json({ data: scores, total: scores.length });
});

/**
 * GET /v1/risk/strategies/:name
 * Get the latest risk score for a specific strategy.
 */
router.get("/risk/strategies/:name", async (req, res) => {
  const { name } = req.params;
  const score = await getLatestStrategyRiskScore(name);
  if (!score) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `No risk score found for strategy "${name}". Run a backtest and trigger scoring first.`,
      },
    });
    return;
  }
  res.json({ score });
});

/**
 * POST /v1/risk/strategies/score
 * Manually trigger risk scoring for a strategy or all strategies.
 */
router.post("/risk/strategies/score", async (req, res) => {
  const { strategyName } = req.body as { strategyName?: string };

  if (strategyName) {
    const score = await scoreStrategy(strategyName);
    if (!score) {
      res.status(422).json({
        error: {
          code: "INSUFFICIENT_DATA",
          message: `No completed backtest runs found for strategy "${strategyName}".`,
        },
      });
      return;
    }
    res.status(201).json({ score });
  } else {
    // Score all
    await scoreAllStrategies();
    const scores = await listStrategyRiskScores();
    res.status(201).json({ data: scores, total: scores.length });
  }
});

export default router;
