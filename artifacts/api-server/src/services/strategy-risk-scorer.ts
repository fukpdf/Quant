import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { performanceMetricsTable, backtestRunsTable, strategyDefinitionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { upsertStrategyRiskScore, appendAuditLog } from "./risk-db";
import type { StrategyRiskScore } from "@workspace/db";

/**
 * Strategy Risk Scorer — Phase 6.
 *
 * Derives risk scores from completed backtest runs.
 * Uses recent completed backtest performance metrics to produce:
 *   - Win Rate Score (0–100)
 *   - Drawdown Score (0–100, higher = safer)
 *   - Sharpe Score (0–100)
 *   - Consistency Score (0–100, lower variance across runs = higher score)
 *   - Trade Frequency Score (0–100, penalizes too few or too many)
 *   - Exposure Score (0–100, lower avg exposure = higher score)
 *   - Overall Risk Score (weighted composite, 0–100, higher = safer)
 *   - Health Score (0–100, based on data recency and volume)
 *   - Confidence Score (0–100, combination of quality + consistency)
 *
 * All scores: 0 = maximum risk / lowest quality, 100 = best / most confident.
 */

/** Number of recent completed runs to use for scoring */
const LOOKBACK_RUNS = 10;

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

function scoreWinRate(winRate: number): number {
  // 0% = 0 score, 50% = 50 score, 70%+ = 100 score
  if (winRate >= 0.7) return 100;
  if (winRate <= 0) return 0;
  return clamp((winRate / 0.7) * 100);
}

function scoreMaxDrawdown(maxDrawdownPct: number): number {
  // 0% drawdown = 100, 50%+ = 0
  const dd = Math.abs(maxDrawdownPct);
  if (dd >= 50) return 0;
  return clamp(100 - (dd / 50) * 100);
}

function scoreSharpe(sharpe: number): number {
  // < 0 = 0, 0.5 = 25, 1.0 = 50, 2.0 = 100
  if (sharpe <= 0) return 0;
  if (sharpe >= 2.0) return 100;
  return clamp((sharpe / 2.0) * 100);
}

function scoreTradeFrequency(totalTrades: number, windowDays: number): number {
  // Ideal: 1–5 trades/week. Penalize too few (<10 over window) or too many (>500).
  const tradesPerWeek = windowDays > 0 ? (totalTrades / windowDays) * 7 : 0;
  if (tradesPerWeek < 0.1) return 10; // too few signals
  if (tradesPerWeek > 50) return 20; // overtrading
  if (tradesPerWeek >= 1 && tradesPerWeek <= 10) return 100;
  return 60; // acceptable frequency
}

function scoreExposure(exposureTimePct: number | null): number {
  // Lower exposure = higher score (less time at risk)
  if (exposureTimePct === null) return 50;
  const e = Math.min(exposureTimePct, 100);
  // Full exposure (100%) = 0 score for exposure, no exposure = 100
  // In practice, 20–60% exposure is healthy for trend strategies
  if (e <= 30) return 100;
  if (e <= 60) return 80;
  if (e <= 80) return 60;
  return 30;
}

function scoreConsistency(values: number[]): number {
  if (values.length < 2) return 50; // not enough data
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return 50;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const cv = Math.sqrt(variance) / Math.abs(mean); // coefficient of variation
  // Low CV = consistent = high score
  if (cv <= 0.1) return 100;
  if (cv <= 0.3) return 80;
  if (cv <= 0.5) return 60;
  if (cv <= 1.0) return 40;
  return 20;
}

/**
 * Compute and store risk scores for a single strategy.
 */
export async function scoreStrategy(strategyName: string): Promise<StrategyRiskScore | null> {
  // Load recent completed backtest runs for this strategy
  const runs = await db
    .select({
      id: backtestRunsTable.id,
      status: backtestRunsTable.status,
      startDate: backtestRunsTable.startDate,
      endDate: backtestRunsTable.endDate,
    })
    .from(backtestRunsTable)
    .where(
      and(
        eq(backtestRunsTable.strategyName, strategyName),
        eq(backtestRunsTable.status, "completed"),
      ),
    )
    .orderBy(desc(backtestRunsTable.createdAt))
    .limit(LOOKBACK_RUNS);

  if (runs.length === 0) {
    logger.debug({ strategyName }, "No completed backtest runs — skipping risk scoring");
    return null;
  }

  const runIds = runs.map((r) => r.id);

  // Load all metrics in parallel (one per run)
  const allMetricsNested = await Promise.all(
    runIds.map((id: string) =>
      db
        .select()
        .from(performanceMetricsTable)
        .where(eq(performanceMetricsTable.backtestRunId, id))
        .limit(1),
    ),
  );

  const validMetrics = allMetricsNested
    .flatMap((m) => m)
    .filter((m) => m !== undefined);

  if (validMetrics.length === 0) {
    logger.debug({ strategyName }, "No performance metrics found — skipping risk scoring");
    return null;
  }

  // Extract numeric arrays for scoring
  const winRates = validMetrics.map((m) => parseFloat(m.winRate ?? "0.5"));
  const drawdowns = validMetrics.map((m) => parseFloat(m.maxDrawdownPct ?? "0"));
  const sharpes = validMetrics.map((m) => parseFloat(m.sharpeRatio ?? "0"));
  const tradeCounts = validMetrics.map((m) => m.totalTrades ?? 0);
  const exposures = validMetrics.map((m) =>
    m.exposureTimePct ? parseFloat(m.exposureTimePct) : null,
  );

  // Estimate average window size (days) from run date ranges
  const avgWindowDays =
    runs
      .map((r) => {
        if (!r.startDate || !r.endDate) return 90;
        const diff =
          (new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) /
          (1000 * 60 * 60 * 24);
        return Math.max(1, diff);
      })
      .reduce((a: number, b: number) => a + b, 0) / runs.length;

  const avgTrades = tradeCounts.reduce((a: number, b: number) => a + b, 0) / tradeCounts.length;

  // Individual scores
  const winRateScore = clamp(
    winRates.map(scoreWinRate).reduce((a: number, b: number) => a + b, 0) / winRates.length,
  );
  const drawdownScore = clamp(
    drawdowns.map(scoreMaxDrawdown).reduce((a: number, b: number) => a + b, 0) / drawdowns.length,
  );
  const sharpeScore = clamp(
    sharpes.map(scoreSharpe).reduce((a: number, b: number) => a + b, 0) / sharpes.length,
  );
  const consistencyScore = clamp(scoreConsistency(sharpes));
  const tradeFrequencyScore = clamp(scoreTradeFrequency(avgTrades, avgWindowDays));
  const exposureScore = clamp(
    exposures
      .map(scoreExposure)
      .reduce((a: number, b: number) => a + b, 0) / exposures.length,
  );

  // Weighted composite risk score
  // Drawdown safety (30%) + Sharpe (25%) + Win Rate (20%) + Consistency (15%) + Freq (5%) + Exposure (5%)
  const overallRiskScore = clamp(
    drawdownScore * 0.30 +
    sharpeScore * 0.25 +
    winRateScore * 0.20 +
    consistencyScore * 0.15 +
    tradeFrequencyScore * 0.05 +
    exposureScore * 0.05,
  );

  // Health: based on sample size and recency
  const healthScore = clamp(
    Math.min(100, (validMetrics.length / LOOKBACK_RUNS) * 100) * 0.6 +
    Math.min(100, avgTrades / 30 * 100) * 0.4,
  );

  // Confidence: overall quality × health
  const confidenceScore = clamp((overallRiskScore * healthScore) / 100);

  const score = await upsertStrategyRiskScore({
    strategyName,
    winRateScore: String(winRateScore.toFixed(2)),
    drawdownScore: String(drawdownScore.toFixed(2)),
    sharpeScore: String(sharpeScore.toFixed(2)),
    consistencyScore: String(consistencyScore.toFixed(2)),
    tradeFrequencyScore: String(tradeFrequencyScore.toFixed(2)),
    exposureScore: String(exposureScore.toFixed(2)),
    overallRiskScore: String(overallRiskScore.toFixed(2)),
    healthScore: String(healthScore.toFixed(2)),
    confidenceScore: String(confidenceScore.toFixed(2)),
    sampleSize: validMetrics.length,
    calculatedAt: new Date(),
  });

  logger.info(
    {
      strategyName,
      overallRiskScore: overallRiskScore.toFixed(2),
      confidenceScore: confidenceScore.toFixed(2),
      sampleSize: validMetrics.length,
    },
    "Strategy risk score computed",
  );

  await appendAuditLog({
    actor: "scheduler",
    action: "strategy_risk_score.compute",
    entityType: "strategy",
    entityId: strategyName,
    payload: { strategyName, overallRiskScore, confidenceScore, sampleSize: validMetrics.length },
    result: "success",
  });

  return score;
}

/**
 * Score all known strategies from the strategy_definitions table.
 */
export async function scoreAllStrategies(): Promise<void> {
  const strategies = await db
    .select({ name: strategyDefinitionsTable.name })
    .from(strategyDefinitionsTable);

  await Promise.all(strategies.map((s: { name: string }) => scoreStrategy(s.name)));
}
