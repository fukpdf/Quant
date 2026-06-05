/**
 * recommendation-engine.ts
 *
 * Rule-based (NO AI) recommendation engine.
 * Generates actionable portfolio recommendations based on:
 * - Health scores
 * - Diversification metrics
 * - Allocation analysis
 * - Performance metrics
 *
 * Rule types:
 *   reduce_concentration        — single asset > threshold
 *   increase_diversification    — too few assets/strategies
 *   reduce_exposure             — deployed > safe threshold
 *   rebalance_portfolio         — significant allocation drift
 *   review_strategy             — strategy underperforming
 *   review_asset_allocation     — asset allocation imbalanced
 *   improve_efficiency          — low capital utilization
 *   reduce_drawdown_risk        — drawdown approaching limits
 *
 * Never auto-executes. Informational only.
 */

import {
  supersedePreviousRecommendations,
  saveRecommendations,
  appendAnalyticsAuditLog,
} from "./analytics-db";
import { logger } from "../lib/logger";
import type { PortfolioHealthScore, AllocationSnapshot } from "./types-analytics";

// We import the analysis types
import type { AllocationAnalysis } from "./allocation-tracker";
import type { DiversificationAnalysis as DivAnalysis } from "./diversification-engine";

function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

interface RecommendationInput {
  accountId: string;
  health?: { overallScore: number; grade: string; details: Record<string, unknown> } | null;
  diversification?: DivAnalysis | null;
  allocation?: AllocationAnalysis | null;
}

interface GeneratedRecommendation {
  recommendationType: string;
  title: string;
  description: string;
  priority: string;
  triggerRule: string;
  targetEntity?: string;
  supportingData: Record<string, unknown>;
  sortOrder: number;
}

export async function generateAndSaveRecommendations(input: RecommendationInput): Promise<number> {
  const startMs = Date.now();
  logger.info({ accountId: input.accountId }, "Generating recommendations");

  const generated: GeneratedRecommendation[] = [];

  // ----- Rule: Reduce Concentration -----
  if (input.diversification) {
    const { concentrationRisk, assetConcentration } = input.diversification;
    if (concentrationRisk.largestPositionPct > 40) {
      generated.push({
        recommendationType: "reduce_concentration",
        title: "High Asset Concentration Detected",
        description: `${concentrationRisk.largestPositionSymbol} represents ${concentrationRisk.largestPositionPct.toFixed(1)}% of your portfolio. Consider reducing this position to below 25% to limit single-asset risk.`,
        priority: concentrationRisk.largestPositionPct > 60 ? "high" : "medium",
        triggerRule: "concentration_limit_breach",
        targetEntity: concentrationRisk.largestPositionSymbol,
        supportingData: {
          currentPct: concentrationRisk.largestPositionPct,
          thresholdPct: 40,
          top3Pct: concentrationRisk.top3ConcentrationPct,
        },
        sortOrder: 1,
      });
    }
  }

  // ----- Rule: Increase Diversification -----
  if (input.diversification) {
    const { overallDiversificationScore, assetConcentration, strategyConcentration } = input.diversification;
    if (overallDiversificationScore < 40) {
      generated.push({
        recommendationType: "increase_diversification",
        title: "Portfolio Under-Diversified",
        description: `Your diversification score is ${overallDiversificationScore.toFixed(0)}/100. You currently hold ${assetConcentration.length} asset(s) across ${strategyConcentration.length} strategy/strategies. Consider adding uncorrelated assets or strategies to reduce concentration risk.`,
        priority: overallDiversificationScore < 25 ? "high" : "medium",
        triggerRule: "low_diversification_score",
        supportingData: {
          diversificationScore: overallDiversificationScore,
          assetCount: assetConcentration.length,
          strategyCount: strategyConcentration.length,
          hhi: input.diversification.hhi,
          effectiveN: input.diversification.effectiveN,
        },
        sortOrder: 2,
      });
    }
  }

  // ----- Rule: Reduce Exposure -----
  if (input.allocation) {
    const { investedAllocationPct } = input.allocation;
    if (investedAllocationPct > 90) {
      generated.push({
        recommendationType: "reduce_exposure",
        title: "Portfolio Nearly Fully Deployed",
        description: `${investedAllocationPct.toFixed(1)}% of your portfolio is invested with no cash buffer. Maintaining 5–15% cash provides flexibility for opportunities and drawdown protection.`,
        priority: investedAllocationPct > 98 ? "high" : "medium",
        triggerRule: "high_exposure",
        supportingData: {
          investedPct: investedAllocationPct,
          cashPct: input.allocation.cashAllocationPct,
          recommendedCashBuffer: "5-15%",
        },
        sortOrder: 3,
      });
    }
  }

  // ----- Rule: Improve Efficiency (low deployment) -----
  if (input.allocation) {
    const { investedAllocationPct, totalEquity } = input.allocation;
    if (investedAllocationPct < 20 && totalEquity > 0 && input.allocation.activeStrategyCount > 0) {
      generated.push({
        recommendationType: "improve_efficiency",
        title: "Low Capital Utilization",
        description: `Only ${investedAllocationPct.toFixed(1)}% of your capital is currently deployed despite having ${input.allocation.activeStrategyCount} active strategy/strategies. Review strategy intervals and signal conditions.`,
        priority: "low",
        triggerRule: "low_capital_utilization",
        supportingData: {
          investedPct: investedAllocationPct,
          cashPct: input.allocation.cashAllocationPct,
          activeStrategies: input.allocation.activeStrategyCount,
        },
        sortOrder: 6,
      });
    }
  }

  // ----- Rule: Rebalance Portfolio (allocation drift) -----
  if (input.allocation?.driftFromPrevious) {
    const largeDrifts = input.allocation.driftFromPrevious.filter(d => Math.abs(d.drift) > 15);
    if (largeDrifts.length > 0) {
      const driftDesc = largeDrifts.map(d => `${d.symbol}: ${d.drift > 0 ? "+" : ""}${d.drift.toFixed(1)}%`).join(", ");
      generated.push({
        recommendationType: "rebalance_portfolio",
        title: "Significant Allocation Drift Detected",
        description: `Portfolio allocation has drifted significantly from the previous snapshot: ${driftDesc}. Consider rebalancing to maintain your intended allocation targets.`,
        priority: "medium",
        triggerRule: "allocation_drift",
        supportingData: { drifts: largeDrifts },
        sortOrder: 4,
      });
    }
  }

  // ----- Rule: Reduce Drawdown Risk -----
  if (input.health?.details) {
    const riskDetails = input.health.details["risk"] as Record<string, number> | undefined;
    if (riskDetails && riskDetails["maxDrawdown"] != null && riskDetails["maxDrawdown"] > 20) {
      generated.push({
        recommendationType: "reduce_drawdown_risk",
        title: "Elevated Drawdown Risk",
        description: `Maximum drawdown has reached ${riskDetails["maxDrawdown"].toFixed(1)}%. Consider tightening stop-loss parameters, reducing position sizes, or pausing aggressive strategies to protect capital.`,
        priority: riskDetails["maxDrawdown"] > 30 ? "high" : "medium",
        triggerRule: "drawdown_threshold_breach",
        supportingData: {
          maxDrawdown: riskDetails["maxDrawdown"],
          riskScore: input.health.overallScore,
        },
        sortOrder: 5,
      });
    }
  }

  // ----- Rule: Review Strategy (health grade D or F) -----
  if (input.health && (input.health.grade === "D" || input.health.grade === "F")) {
    generated.push({
      recommendationType: "review_strategy",
      title: `Portfolio Health Grade: ${input.health.grade} — Review Required`,
      description: `Overall portfolio health score is ${input.health.overallScore.toFixed(0)}/100 (Grade ${input.health.grade}). Review your active strategies, risk parameters, and recent trade history to identify areas for improvement.`,
      priority: input.health.grade === "F" ? "high" : "medium",
      triggerRule: "low_health_grade",
      supportingData: {
        overallScore: input.health.overallScore,
        grade: input.health.grade,
      },
      sortOrder: 7,
    });
  }

  // ----- Rule: Review Asset Allocation (correlation) -----
  if (input.diversification?.correlationExposure?.correlationRisk === "high") {
    generated.push({
      recommendationType: "review_asset_allocation",
      title: "High Asset Correlation Detected",
      description: `Your assets show high pairwise correlation (avg: ${(input.diversification.correlationExposure.avgPairwiseCorrelation! * 100).toFixed(1)}%). During market stress, highly correlated assets tend to decline together, reducing diversification benefit. Consider adding uncorrelated assets.`,
      priority: "medium",
      triggerRule: "high_correlation_exposure",
      supportingData: {
        avgCorrelation: input.diversification.correlationExposure.avgPairwiseCorrelation,
        maxCorrelation: input.diversification.correlationExposure.maxCorrelation,
      },
      sortOrder: 8,
    });
  }

  if (generated.length === 0) {
    logger.info({ accountId: input.accountId }, "No recommendations generated");
    return 0;
  }

  // Supersede old recommendations of same types before saving new ones
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  for (const rec of generated) {
    await supersedePreviousRecommendations(input.accountId, rec.recommendationType);
  }

  await saveRecommendations(generated.map(rec => ({
    accountId: input.accountId,
    recommendationType: rec.recommendationType,
    title: rec.title,
    description: rec.description,
    priority: rec.priority,
    triggerRule: rec.triggerRule ?? undefined,
    targetEntity: rec.targetEntity ?? undefined,
    supportingData: rec.supportingData,
    isAcknowledged: false,
    isSuperseded: false,
    sortOrder: rec.sortOrder,
    generatedAt: now,
    expiresAt,
  })));

  await appendAnalyticsAuditLog({
    actor: "system",
    action: "recommendation.generate",
    accountId: input.accountId,
    result: "success",
    durationMs: String(Date.now() - startMs),
    payload: { count: generated.length, types: generated.map(r => r.recommendationType) },
  });

  logger.info({ accountId: input.accountId, count: generated.length }, "Recommendations generated");
  return generated.length;
}
