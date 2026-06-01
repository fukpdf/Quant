import { Router, type IRouter } from "express";
import { z } from "zod";
import { getBacktestRun, getMetricsForRun, getTradesForRun } from "../../services/research-db";
import {
  getValidationResultForRun,
  getValidationResultForWalkForward,
  getWalkForwardRun,
} from "../../services/phase4-db";
import { generateAndSaveValidation } from "../../services/validation-engine";
import type { ComputedMetrics } from "../../services/performance-calculator";

const router: IRouter = Router();

const PostValidationSchema = z.object({
  /** Backtest run ID to validate */
  backtestRunId: z.string().uuid().optional(),
  /** Walk-forward run ID to include in validation (improves overfitting detection) */
  walkForwardRunId: z.string().uuid().optional(),
  /** Override minimum trade threshold (default 30) */
  minTradesThreshold: z.number().int().min(5).max(1000).optional().default(30),
  /** Override max drawdown threshold as a fraction (default 0.30) */
  maxDrawdownThreshold: z.number().min(0.05).max(1.0).optional().default(0.30),
});

/**
 * GET /v1/research/validation/:id
 * Get an existing validation result by its own ID or by backtest run ID.
 *
 * The :id parameter is interpreted as a backtest run ID (not the validation result ID).
 */
router.get("/research/validation/:id", async (req, res) => {
  const { id } = req.params;

  // Try to find by backtest_run_id first
  const result = await getValidationResultForRun(id);

  if (!result) {
    // Try as a walk-forward run ID
    const wfResult = await getValidationResultForWalkForward(id);
    if (!wfResult) {
      res.status(404).json({
        error: {
          code: "NOT_FOUND",
          message: `No validation result found for run: ${id}`,
        },
      });
      return;
    }
    const findings = JSON.parse(wfResult.findings);
    res.json({ validation: { ...wfResult, findings: undefined }, findings });
    return;
  }

  const findings = JSON.parse(result.findings);
  res.json({ validation: { ...result, findings: undefined }, findings });
});

/**
 * POST /v1/research/validation
 * Generate (or regenerate) a validation report for a completed backtest.
 */
router.post("/research/validation", async (req, res) => {
  const parse = PostValidationSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { backtestRunId, walkForwardRunId, minTradesThreshold, maxDrawdownThreshold } = parse.data;

  if (!backtestRunId && !walkForwardRunId) {
    res.status(400).json({
      error: { code: "MISSING_PARAM", message: "Either backtestRunId or walkForwardRunId is required" },
    });
    return;
  }

  // Load metrics for the backtest run
  let metrics: ComputedMetrics | null = null;
  if (backtestRunId) {
    const run = await getBacktestRun(backtestRunId);
    if (!run) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: `Backtest run not found: ${backtestRunId}` },
      });
      return;
    }
    if (run.status !== "completed") {
      res.status(400).json({
        error: { code: "RUN_NOT_COMPLETE", message: `Backtest run ${backtestRunId} is not completed` },
      });
      return;
    }
    const rawMetrics = await getMetricsForRun(backtestRunId);
    if (!rawMetrics) {
      res.status(404).json({
        error: { code: "METRICS_NOT_FOUND", message: `No metrics for run: ${backtestRunId}` },
      });
      return;
    }
    // Convert DB numeric strings to numbers for the validation engine
    metrics = {
      totalReturnPct: parseFloat(String(rawMetrics.totalReturnPct)),
      annualizedReturnPct: rawMetrics.annualizedReturnPct !== null ? parseFloat(String(rawMetrics.annualizedReturnPct)) : null,
      winRate: parseFloat(String(rawMetrics.winRate)),
      profitFactor: rawMetrics.profitFactor !== null ? parseFloat(String(rawMetrics.profitFactor)) : null,
      avgWinPct: rawMetrics.avgWinPct !== null ? parseFloat(String(rawMetrics.avgWinPct)) : null,
      avgLossPct: rawMetrics.avgLossPct !== null ? parseFloat(String(rawMetrics.avgLossPct)) : null,
      maxDrawdownPct: parseFloat(String(rawMetrics.maxDrawdownPct)),
      sharpeRatio: rawMetrics.sharpeRatio !== null ? parseFloat(String(rawMetrics.sharpeRatio)) : null,
      sortinoRatio: rawMetrics.sortinoRatio !== null ? parseFloat(String(rawMetrics.sortinoRatio)) : null,
      totalTrades: rawMetrics.totalTrades,
      winningTrades: rawMetrics.winningTrades,
      losingTrades: rawMetrics.losingTrades,
      expectancy: rawMetrics.expectancy !== null ? parseFloat(String(rawMetrics.expectancy)) : null,
      calmarRatio: rawMetrics.calmarRatio !== null ? parseFloat(String(rawMetrics.calmarRatio)) : null,
      recoveryFactor: rawMetrics.recoveryFactor !== null ? parseFloat(String(rawMetrics.recoveryFactor)) : null,
      ulcerIndex: rawMetrics.ulcerIndex !== null ? parseFloat(String(rawMetrics.ulcerIndex)) : null,
      marRatio: rawMetrics.marRatio !== null ? parseFloat(String(rawMetrics.marRatio)) : null,
      exposureTimePct: rawMetrics.exposureTimePct !== null ? parseFloat(String(rawMetrics.exposureTimePct)) : null,
      avgTradeDurationDays: rawMetrics.avgTradeDurationDays !== null ? parseFloat(String(rawMetrics.avgTradeDurationDays)) : null,
      ulcerPerformanceIndex: rawMetrics.ulcerPerformanceIndex !== null ? parseFloat(String(rawMetrics.ulcerPerformanceIndex)) : null,
      probabilityOfRuin: null,
      totalCommission: parseFloat(String(rawMetrics.totalCommission)),
      totalSlippage: parseFloat(String(rawMetrics.totalSlippage)),
    };
  }

  // Load walk-forward window results for overfitting/instability detection
  let walkForwardWindows: any[] = [];
  if (walkForwardRunId) {
    const wfRun = await getWalkForwardRun(walkForwardRunId);
    if (wfRun?.windowResults) {
      walkForwardWindows = JSON.parse(wfRun.windowResults);
    }
  }

  // If we only have a walk-forward run and no backtest metrics, use a stub
  if (metrics === null) {
    res.status(400).json({
      error: { code: "MISSING_PARAM", message: "backtestRunId is required to generate metrics-based validation" },
    });
    return;
  }

  const savedResult = await generateAndSaveValidation(
    metrics,
    {
      backtestRunId: backtestRunId ?? undefined,
      walkForwardRunId: walkForwardRunId ?? undefined,
    },
    walkForwardWindows,
    { minTradesThreshold, maxDrawdownThreshold },
  );

  const findings = JSON.parse(savedResult.findings);
  res.json({ validation: { ...savedResult, findings: undefined }, findings });
});

export default router;
