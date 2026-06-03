/**
 * ai-optimization-assistant.ts — Phase 11 AI-Assisted Research & Optimization.
 *
 * Integrates the Phase 8 LLM provider with Phase 11 intelligence data to:
 *
 *   - Analyze strategy backtest results and identify weaknesses
 *   - Detect signs of in-sample overfitting
 *   - Recommend parameter adjustments
 *   - Suggest optimization strategies
 *   - Assess regime suitability
 *   - Compare strategy portfolios
 *
 * Advisory only — AI cannot execute trades, change positions, or override
 * risk controls. All outputs are research findings recorded in the DB.
 */

import { logger } from "../lib/logger";
import { AiProviderFactory } from "./ai-provider-factory";
import {
  insertAiResearchJob,
  updateAiResearchJob,
  insertAiResearchFindingsBatch,
  listAiResearchJobs,
  listAiResearchFindings,
  acknowledgeFinding,
  getAiResearchJobById,
} from "./intelligence-db";
import type {
  ResearchJobType,
  ResearchJobPriority,
  ResearchFinding,
  FindingType,
  FindingSeverity,
} from "./intelligence-types";
import { db } from "@workspace/db";
import {
  backtestRunsTable,
  performanceMetricsTable,
  walkForwardRunsTable,
  monteCarloRunsTable,
} from "@workspace/db/schema";
import { eq, and, desc } from "drizzle-orm";


// ---------------------------------------------------------------------------
// Context Builders
// ---------------------------------------------------------------------------

async function buildStrategyContext(strategyName: string): Promise<string> {
  const runs = await db
    .select()
    .from(backtestRunsTable)
    .where(and(eq(backtestRunsTable.strategyName, strategyName), eq(backtestRunsTable.status, "completed")))
    .orderBy(desc(backtestRunsTable.createdAt))
    .limit(5);

  if (runs.length === 0) return `Strategy "${strategyName}" has no completed backtest runs.`;

  const metricsList = await Promise.all(
    runs.map(async (run) => {
      const [m] = await db
        .select()
        .from(performanceMetricsTable)
        .where(eq(performanceMetricsTable.backtestRunId, run.id))
        .limit(1);
      return { run, metrics: m };
    }),
  );

  const [wf] = await db
    .select()
    .from(walkForwardRunsTable)
    .where(eq(walkForwardRunsTable.strategyName, strategyName))
    .orderBy(desc(walkForwardRunsTable.createdAt))
    .limit(1);

  const [mc] = await db
    .select()
    .from(monteCarloRunsTable)
    .where(eq(monteCarloRunsTable.backtestRunId, runs[0].id))
    .limit(1);

  const metricsText = metricsList
    .filter((x) => x.metrics)
    .map(
      (x) =>
        `Run ${x.run.id.slice(0, 8)} (${x.run.symbol} ${x.run.interval}): ` +
        `Sharpe=${x.metrics!.sharpeRatio}, Sortino=${x.metrics!.sortinoRatio}, ` +
        `Return=${x.metrics!.totalReturnPct}%, MaxDD=${x.metrics!.maxDrawdownPct}%, ` +
        `WinRate=${x.metrics!.winRate}, Trades=${x.metrics!.totalTrades}`,
    )
    .join("\n");

  const wfText = wf
    ? `Walk-Forward: consistency=${wf.consistencyScore}, ${wf.windowCount} windows, status=${wf.status}`
    : "Walk-Forward: not run";

  const mcText = mc
    ? `Monte Carlo: median_return=${mc.medianReturn}, worst_case=${mc.worstCaseReturn}, simulations=${mc.simulations}`
    : "Monte Carlo: not run";

  return [
    `Strategy: ${strategyName}`,
    `Parameters: ${JSON.stringify(runs[0].parameters ?? {})}`,
    `\nBacktest History (latest 5):\n${metricsText}`,
    `\n${wfText}`,
    `\n${mcText}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert quantitative research assistant embedded in QuantForge, a personal algorithmic trading research platform.

Your role is ADVISORY ONLY. You:
- Analyze strategy backtest performance data
- Identify weaknesses, risks, and improvement opportunities
- Detect overfitting patterns
- Recommend parameter adjustments for further research
- Assess regime suitability

You CANNOT and MUST NOT:
- Execute any trade or order
- Change any live position
- Override any risk control
- Make guarantees about future performance

Respond with a structured JSON object matching the requested analysis type.
Always base findings on the provided data. Be specific, actionable, and conservative.`;

// ---------------------------------------------------------------------------
// Analysis Runners
// ---------------------------------------------------------------------------

async function analyzeStrategy(
  strategyName: string,
  inputParameters: Record<string, unknown>,
): Promise<ResearchFinding[]> {
  const context = await buildStrategyContext(strategyName);
  const provider = AiProviderFactory.getProvider();

  const prompt = `${SYSTEM_PROMPT}

TASK: Perform a deep analysis of the following strategy and identify findings.

${context}

Respond with a JSON array of findings with this schema:
[{
  "findingType": "insight|recommendation|warning|overfitting|parameter_change",
  "severity": "info|warning|critical",
  "title": "Short title",
  "description": "Detailed explanation",
  "evidence": { "key": "value" },
  "suggestedActions": ["action 1", "action 2"],
  "confidenceScore": 0.8
}]`;

  try {
    const response = await provider.complete([{ role: "user" as const, content: prompt }], { maxTokens: 1500 });
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return defaultFindings(strategyName);
    return JSON.parse(jsonMatch[0]) as ResearchFinding[];
  } catch (err) {
    logger.warn({ err }, "AI strategy analysis failed — returning defaults");
    return defaultFindings(strategyName);
  }
}

async function detectOverfitting(
  strategyName: string,
  inputParameters: Record<string, unknown>,
): Promise<ResearchFinding[]> {
  const context = await buildStrategyContext(strategyName);
  const provider = AiProviderFactory.getProvider();

  const prompt = `${SYSTEM_PROMPT}

TASK: Analyze this strategy for signs of in-sample overfitting.

Key overfitting signals to check:
1. Walk-forward efficiency ratio < 0.5 (out-of-sample much worse than in-sample)
2. Monte Carlo p5 drawdown much worse than backtest max drawdown
3. Very high trade count with marginal edge
4. Parameter sensitivity: does changing params by 10% collapse performance?
5. Sharpe in-sample >> 2.0 but walk-forward deteriorates significantly

${context}

Respond with JSON array of findings:
[{
  "findingType": "overfitting|warning|insight",
  "severity": "info|warning|critical",
  "title": "...",
  "description": "...",
  "evidence": {},
  "suggestedActions": [],
  "confidenceScore": 0.0
}]`;

  try {
    const response = await provider.complete([{ role: "user" as const, content: prompt }], { maxTokens: 1200 });
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [overfittingDefaultFinding(strategyName)];
    return JSON.parse(jsonMatch[0]) as ResearchFinding[];
  } catch {
    return [overfittingDefaultFinding(strategyName)];
  }
}

async function recommendOptimization(
  strategyName: string,
  inputParameters: Record<string, unknown>,
): Promise<ResearchFinding[]> {
  const context = await buildStrategyContext(strategyName);
  const provider = AiProviderFactory.getProvider();

  const prompt = `${SYSTEM_PROMPT}

TASK: Recommend optimization approaches and parameter ranges for this strategy.

${context}

Additional context: ${JSON.stringify(inputParameters)}

Provide specific parameter suggestions with rationale.
Respond with JSON array:
[{
  "findingType": "recommendation|parameter_change",
  "severity": "info|warning",
  "title": "...",
  "description": "...",
  "evidence": { "current_params": {}, "suggested_params": {}, "expected_improvement": "..." },
  "suggestedActions": ["..."],
  "confidenceScore": 0.0
}]`;

  try {
    const response = await provider.complete([{ role: "user" as const, content: prompt }], { maxTokens: 1200 });
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return defaultOptimizationFindings(strategyName);
    return JSON.parse(jsonMatch[0]) as ResearchFinding[];
  } catch {
    return defaultOptimizationFindings(strategyName);
  }
}

async function assessRegimeAdaptation(
  strategyName: string,
  inputParameters: Record<string, unknown>,
): Promise<ResearchFinding[]> {
  const context = await buildStrategyContext(strategyName);
  const provider = AiProviderFactory.getProvider();
  const regimeType = (inputParameters.regimeType as string) ?? "unknown";

  const prompt = `${SYSTEM_PROMPT}

TASK: Assess how well this strategy is suited to the current market regime: ${regimeType}

${context}

Consider:
- Bull regimes: trend-following strategies tend to outperform
- Bear regimes: mean-reversion and short strategies may outperform
- High volatility: reduce position sizing, widen stops
- Low volatility: strategies may underperform, risk of false breakouts
- Sideways: mean-reversion strategies favored

Respond with JSON array of findings.`;

  try {
    const response = await provider.complete([{ role: "user" as const, content: prompt }], { maxTokens: 1000 });
    const jsonMatch = response.content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return defaultRegimeFindings(strategyName, regimeType);
    return JSON.parse(jsonMatch[0]) as ResearchFinding[];
  } catch {
    return defaultRegimeFindings(strategyName, regimeType);
  }
}

// ---------------------------------------------------------------------------
// Default Fallbacks (when AI provider returns unexpected format)
// ---------------------------------------------------------------------------

function defaultFindings(strategyName: string): ResearchFinding[] {
  return [
    {
      findingType: "insight",
      severity: "info",
      title: "Strategy Analysis Complete",
      description: `Analysis of ${strategyName} completed. Review the backtest metrics for performance assessment.`,
      evidence: {},
      suggestedActions: ["Review Sharpe ratio trend across runs", "Run walk-forward validation"],
      confidenceScore: 0.6,
    },
  ];
}

function overfittingDefaultFinding(strategyName: string): ResearchFinding {
  return {
    findingType: "overfitting",
    severity: "warning",
    title: "Overfitting Check Required",
    description: `Could not complete automated overfitting analysis for ${strategyName}. Manual review recommended.`,
    evidence: {},
    suggestedActions: [
      "Compare in-sample vs out-of-sample Sharpe",
      "Run walk-forward validation",
      "Test with Monte Carlo simulation",
    ],
    confidenceScore: 0.4,
  };
}

function defaultOptimizationFindings(strategyName: string): ResearchFinding[] {
  return [
    {
      findingType: "recommendation",
      severity: "info",
      title: "Run Grid Search Optimization",
      description: `Consider running a grid search across key parameters for ${strategyName} to identify better configurations.`,
      evidence: {},
      suggestedActions: ["Run grid_search optimization", "Try Bayesian optimization for efficiency"],
      confidenceScore: 0.5,
    },
  ];
}

function defaultRegimeFindings(strategyName: string, regime: string): ResearchFinding[] {
  return [
    {
      findingType: "regime_alert",
      severity: "info",
      title: `Regime Compatibility: ${regime}`,
      description: `${strategyName} suitability for ${regime} regime requires manual assessment.`,
      evidence: { regime },
      suggestedActions: ["Review strategy performance during similar historical regimes"],
      confidenceScore: 0.3,
    },
  ];
}

// ---------------------------------------------------------------------------
// Job Dispatcher
// ---------------------------------------------------------------------------

export async function dispatchResearchJob(
  jobType: ResearchJobType,
  strategyName: string | undefined,
  inputParameters: Record<string, unknown> = {},
  priority: ResearchJobPriority = "medium",
  scheduledAt?: Date,
): Promise<string> {
  const job = await insertAiResearchJob({
    jobType,
    strategyName,
    inputParameters,
    status: "pending",
    priority,
    scheduledAt,
  });

  return job.id;
}

export async function executeResearchJob(jobId: string): Promise<void> {
  const job = await getAiResearchJobById(jobId);
  if (!job) throw new Error(`Research job not found: ${jobId}`);
  if (job.status !== "pending") {
    logger.warn({ jobId, status: job.status }, "Job is not in pending state");
    return;
  }

  await updateAiResearchJob(jobId, { status: "running", startedAt: new Date() });

  try {
    let findings: ResearchFinding[] = [];
    const params = (job.inputParameters as Record<string, unknown>) ?? {};

    switch (job.jobType as ResearchJobType) {
      case "strategy_analysis":
        findings = await analyzeStrategy(job.strategyName ?? "unknown", params);
        break;
      case "overfitting_detection":
        findings = await detectOverfitting(job.strategyName ?? "unknown", params);
        break;
      case "optimization_recommendation":
      case "parameter_suggestion":
        findings = await recommendOptimization(job.strategyName ?? "unknown", params);
        break;
      case "regime_adaptation":
        findings = await assessRegimeAdaptation(job.strategyName ?? "unknown", params);
        break;
      case "portfolio_review":
      case "comparative_analysis":
        findings = await analyzeStrategy(job.strategyName ?? "portfolio", params);
        break;
      default:
        findings = defaultFindings(job.strategyName ?? "unknown");
    }

    // Persist findings
    if (findings.length > 0) {
      await insertAiResearchFindingsBatch(
        findings.map((f) => ({
          jobId,
          findingType: (f.findingType as string) ?? "insight",
          severity: (f.severity as string) ?? "info",
          title: f.title ?? "Finding",
          description: f.description ?? "",
          evidence: (f.evidence as Record<string, unknown>) ?? {},
          suggestedActions: (f.suggestedActions as unknown[]) ?? [],
          strategyName: job.strategyName,
          confidenceScore: String(f.confidenceScore ?? 0.5),
          isAcknowledged: false,
        })),
      );
    }

    await updateAiResearchJob(jobId, {
      status: "completed",
      result: { findingsCount: findings.length } as Record<string, unknown>,
      completedAt: new Date(),
    });

    logger.info({ jobId, findingsCount: findings.length }, "Research job completed");
  } catch (err) {
    logger.error({ err, jobId }, "Research job failed");
    await updateAiResearchJob(jobId, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
      completedAt: new Date(),
    });
  }
}

export { listAiResearchJobs, listAiResearchFindings, acknowledgeFinding, getAiResearchJobById };
