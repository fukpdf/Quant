/**
 * Strategy validation engine — Phase 4.
 *
 * Analyses a completed backtest (or walk-forward run) and produces a
 * structured validation report flagging common research pitfalls:
 *   - Overfitting (IS vs OOS performance gap)
 *   - Insufficient sample size (< 30 trades)
 *   - Excessive drawdown (> 30%)
 *   - Low trade count (< 10)
 *   - Strategy instability (high variance across walk-forward windows)
 *
 * Research-only. No live execution.
 */

import type { ComputedMetrics } from "./performance-calculator";
import type { WalkForwardWindowResult } from "./walk-forward-runner";
import { saveValidationResult } from "./phase4-db";
import type { ValidationResult } from "@workspace/db";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FindingSeverity = "info" | "warning" | "critical";

export interface ValidationFinding {
  flag: string;
  severity: FindingSeverity;
  message: string;
}

export interface ValidationReport {
  overallScore: number;
  grade: string;
  overfittingFlag: boolean;
  insufficientSampleFlag: boolean;
  excessiveDrawdownFlag: boolean;
  lowTradeCountFlag: boolean;
  strategyInstabilityFlag: boolean;
  findings: ValidationFinding[];
  recommendation: string;
}

export interface ValidationEngineOptions {
  minTradesThreshold?: number;
  maxDrawdownThreshold?: number;
  minTradeCount?: number;
}

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------
const MIN_TRADES_THRESHOLD = 30;
const MAX_DRAWDOWN_THRESHOLD = 0.30;
const MIN_TRADE_COUNT = 10;
const OVERFITTING_RATIO_THRESHOLD = 0.3; // OOS Sharpe < 30% of IS Sharpe → overfitting

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkSampleSize(totalTrades: number, threshold: number): ValidationFinding | null {
  if (totalTrades < threshold) {
    return {
      flag: "INSUFFICIENT_SAMPLE",
      severity: totalTrades < threshold / 2 ? "critical" : "warning",
      message: `Only ${totalTrades} trades recorded. Minimum recommended: ${threshold}. Results have low statistical significance.`,
    };
  }
  return null;
}

function checkTradeCount(totalTrades: number, min: number): ValidationFinding | null {
  if (totalTrades < min) {
    return {
      flag: "LOW_TRADE_COUNT",
      severity: "critical",
      message: `Strategy generated only ${totalTrades} trade(s). A minimum of ${min} trades is required for any reliable inference.`,
    };
  }
  return null;
}

function checkDrawdown(maxDrawdownPct: number, threshold: number): ValidationFinding | null {
  if (maxDrawdownPct > threshold) {
    const pct = (maxDrawdownPct * 100).toFixed(1);
    return {
      flag: "EXCESSIVE_DRAWDOWN",
      severity: maxDrawdownPct > 0.5 ? "critical" : "warning",
      message: `Maximum drawdown of ${pct}% exceeds the ${(threshold * 100).toFixed(0)}% threshold. Consider tighter position sizing.`,
    };
  }
  return null;
}

function checkNegativeExpectancy(metrics: ComputedMetrics): ValidationFinding | null {
  if (metrics.expectancy !== null && metrics.expectancy < 0) {
    return {
      flag: "NEGATIVE_EXPECTANCY",
      severity: "warning",
      message: `Negative expectancy (${(metrics.expectancy * 100).toFixed(2)}%). The strategy loses money on average per trade.`,
    };
  }
  return null;
}

function checkOverfitting(
  windows: WalkForwardWindowResult[],
): ValidationFinding | null {
  if (windows.length < 2) return null;

  const validWindows = windows.filter(
    (w) => w.isSharpe !== null && w.oosSharpe !== null && Math.abs(w.isSharpe) > 0.01,
  );

  if (validWindows.length < 2) return null;

  const avgIsSharp =
    validWindows.reduce((a, w) => a + (w.isSharpe ?? 0), 0) / validWindows.length;
  const avgOosSharpe =
    validWindows.reduce((a, w) => a + (w.oosSharpe ?? 0), 0) / validWindows.length;

  if (
    avgIsSharp > 0 &&
    avgOosSharpe < avgIsSharp * OVERFITTING_RATIO_THRESHOLD
  ) {
    return {
      flag: "OVERFITTING",
      severity: "critical",
      message:
        `IS Sharpe (${avgIsSharp.toFixed(2)}) vs OOS Sharpe (${avgOosSharpe.toFixed(2)}) ` +
        `shows significant performance degradation out-of-sample. Strategy may be over-fitted to historical data.`,
    };
  }
  return null;
}

function checkInstability(windows: WalkForwardWindowResult[]): ValidationFinding | null {
  if (windows.length < 3) return null;

  const oosReturns = windows.map((w) => w.oosTotalReturnPct);
  const mean = oosReturns.reduce((a, b) => a + b, 0) / oosReturns.length;
  const variance =
    oosReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / oosReturns.length;
  const stdDev = Math.sqrt(variance);

  // High instability: std-dev of OOS returns > 3x the mean absolute return
  if (stdDev > Math.abs(mean) * 3 && stdDev > 0.05) {
    return {
      flag: "STRATEGY_INSTABILITY",
      severity: "warning",
      message: `High variance across walk-forward OOS windows (σ=${(stdDev * 100).toFixed(1)}%). Strategy performance is inconsistent across time periods.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Score and grade
// ---------------------------------------------------------------------------

function scoreAndGrade(
  findings: ValidationFinding[],
  baseScore = 100,
): { score: number; grade: string } {
  let score = baseScore;

  for (const f of findings) {
    switch (f.severity) {
      case "critical":
        score -= 25;
        break;
      case "warning":
        score -= 12;
        break;
      case "info":
        score -= 3;
        break;
    }
  }

  score = Math.max(0, score);

  let grade: string;
  if (score >= 85) grade = "A";
  else if (score >= 70) grade = "B";
  else if (score >= 55) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { score, grade };
}

// ---------------------------------------------------------------------------
// Main validation function
// ---------------------------------------------------------------------------

export function runValidation(
  metrics: ComputedMetrics,
  walkForwardWindows: WalkForwardWindowResult[] = [],
  options: ValidationEngineOptions = {},
): ValidationReport {
  const minTradesThreshold = options.minTradesThreshold ?? MIN_TRADES_THRESHOLD;
  const maxDrawdownThreshold = options.maxDrawdownThreshold ?? MAX_DRAWDOWN_THRESHOLD;
  const minTradeCount = options.minTradeCount ?? MIN_TRADE_COUNT;

  const findings: ValidationFinding[] = [];

  const tradeCountFinding = checkTradeCount(metrics.totalTrades, minTradeCount);
  if (tradeCountFinding) findings.push(tradeCountFinding);

  const sampleFinding = checkSampleSize(metrics.totalTrades, minTradesThreshold);
  if (sampleFinding) findings.push(sampleFinding);

  const drawdownFinding = checkDrawdown(metrics.maxDrawdownPct, maxDrawdownThreshold);
  if (drawdownFinding) findings.push(drawdownFinding);

  const expectancyFinding = checkNegativeExpectancy(metrics);
  if (expectancyFinding) findings.push(expectancyFinding);

  const overfitFinding = checkOverfitting(walkForwardWindows);
  if (overfitFinding) findings.push(overfitFinding);

  const instabilityFinding = checkInstability(walkForwardWindows);
  if (instabilityFinding) findings.push(instabilityFinding);

  const { score, grade } = scoreAndGrade(findings);

  const overfittingFlag = findings.some((f) => f.flag === "OVERFITTING");
  const insufficientSampleFlag = findings.some((f) => f.flag === "INSUFFICIENT_SAMPLE");
  const excessiveDrawdownFlag = findings.some((f) => f.flag === "EXCESSIVE_DRAWDOWN");
  const lowTradeCountFlag = findings.some((f) => f.flag === "LOW_TRADE_COUNT");
  const strategyInstabilityFlag = findings.some((f) => f.flag === "STRATEGY_INSTABILITY");

  let recommendation: string;
  if (grade === "A") {
    recommendation = "Strategy passes all validation checks. Results are statistically robust.";
  } else if (grade === "B") {
    recommendation = "Strategy shows minor concerns. Review flagged findings before deployment.";
  } else if (grade === "C") {
    recommendation = "Strategy has notable weaknesses. Additional testing recommended.";
  } else if (grade === "D") {
    recommendation =
      "Strategy shows significant issues. Do not use without addressing critical findings.";
  } else {
    recommendation =
      "Strategy fails validation. Results are unreliable. Do not use for any trading decisions.";
  }

  return {
    overallScore: score,
    grade,
    overfittingFlag,
    insufficientSampleFlag,
    excessiveDrawdownFlag,
    lowTradeCountFlag,
    strategyInstabilityFlag,
    findings,
    recommendation,
  };
}

// ---------------------------------------------------------------------------
// Persist validation result
// ---------------------------------------------------------------------------

export async function generateAndSaveValidation(
  metrics: ComputedMetrics,
  target: { backtestRunId?: string; portfolioBacktestId?: string; walkForwardRunId?: string },
  walkForwardWindows: WalkForwardWindowResult[] = [],
  options: ValidationEngineOptions = {},
): Promise<ValidationResult> {
  const report = runValidation(metrics, walkForwardWindows, options);

  return saveValidationResult({
    backtestRunId: target.backtestRunId ?? null,
    portfolioBacktestId: target.portfolioBacktestId ?? null,
    walkForwardRunId: target.walkForwardRunId ?? null,
    overallScore: report.overallScore,
    grade: report.grade,
    overfittingFlag: report.overfittingFlag,
    insufficientSampleFlag: report.insufficientSampleFlag,
    excessiveDrawdownFlag: report.excessiveDrawdownFlag,
    lowTradeCountFlag: report.lowTradeCountFlag,
    strategyInstabilityFlag: report.strategyInstabilityFlag,
    findings: JSON.stringify(report.findings),
    recommendation: report.recommendation,
    minTradesThreshold: options.minTradesThreshold ?? MIN_TRADES_THRESHOLD,
    maxDrawdownThreshold: String(options.maxDrawdownThreshold ?? MAX_DRAWDOWN_THRESHOLD),
  });
}
