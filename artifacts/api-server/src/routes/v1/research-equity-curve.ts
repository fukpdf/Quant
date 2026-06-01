import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  getEquityCurveForRun,
  getEquityCurveForPortfolio,
  parseEquityCurveData,
} from "../../services/equity-curve-service";

const router: IRouter = Router();

const GetEquityCurveQuery = z.object({
  /** "backtest" (default) or "portfolio" */
  type: z.enum(["backtest", "portfolio"]).optional().default("backtest"),
  /** Return raw compact JSON or parsed array of {timestamp, equity} objects */
  format: z.enum(["compact", "expanded"]).optional().default("expanded"),
});

/**
 * GET /v1/research/equity-curve/:id
 * Retrieve the equity curve for a backtest run or portfolio backtest.
 *
 * Query params:
 *   type=backtest|portfolio  — which run type to look up
 *   format=compact|expanded  — response format
 */
router.get("/research/equity-curve/:id", async (req, res) => {
  const { id } = req.params;

  const parseQ = GetEquityCurveQuery.safeParse(req.query);
  if (!parseQ.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parseQ.error.message },
    });
    return;
  }

  const { type, format } = parseQ.data;

  const curve =
    type === "portfolio"
      ? await getEquityCurveForPortfolio(id)
      : await getEquityCurveForRun(id);

  if (!curve) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `Equity curve not found for ${type} run: ${id}`,
      },
    });
    return;
  }

  if (format === "compact") {
    res.json({
      id: curve.id,
      backtestRunId: curve.backtestRunId,
      portfolioBacktestId: curve.portfolioBacktestId,
      totalPoints: curve.totalPoints,
      startEquity: curve.startEquity,
      endEquity: curve.endEquity,
      peakEquity: curve.peakEquity,
      maxDrawdownPct: curve.maxDrawdownPct,
      generatedAt: curve.generatedAt,
      curveData: JSON.parse(curve.curveData),
    });
    return;
  }

  // Expanded: parse to array of {timestamp, equity}
  const points = parseEquityCurveData(curve.curveData);

  res.json({
    id: curve.id,
    backtestRunId: curve.backtestRunId,
    portfolioBacktestId: curve.portfolioBacktestId,
    totalPoints: curve.totalPoints,
    startEquity: curve.startEquity,
    endEquity: curve.endEquity,
    peakEquity: curve.peakEquity,
    maxDrawdownPct: curve.maxDrawdownPct,
    generatedAt: curve.generatedAt,
    points,
  });
});

export default router;
