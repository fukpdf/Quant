import { AiProviderFactory } from "./ai-provider-factory";
import { buildContext, formatContextAsPrompt } from "./ai-context-builder";
import {
  createContextSnapshot,
  createInsight,
  createSummary,
  createExplanation,
  recordUsageMetric,
  writeAiAuditLog,
} from "./ai-db";
import type {
  StrategyAnalysisRequest,
  PortfolioAnalysisRequest,
  RiskAnalysisRequest,
  ComparisonRequest,
  LlmMessage,
  ContextDomain,
  LlmUsage,
} from "./ai-types";
import { logger } from "../lib/logger";

/**
 * AI Analysis Service — generates structured analysis for strategies, portfolios, risks, and comparisons.
 *
 * All analysis is human-readable and advisory only.
 * No signal generation. No trade recommendations. No risk overrides.
 */

const ANALYSIS_SYSTEM_PROMPT = `You are a senior quantitative analyst providing analytical explanations for a systematic trading platform.

YOUR ANALYSIS MUST:
- Be grounded in the provided platform data only
- Explain patterns, strengths, and weaknesses in plain English
- Provide specific, data-driven observations rather than generic statements
- Clearly distinguish between what is certain (data) and what is inference
- Use markdown for readability

YOUR ANALYSIS MUST NEVER:
- Recommend specific trades, entries, exits, or position sizes
- Provide market price predictions
- Override or suggest bypassing risk controls
- Claim accuracy about future outcomes
`;

// ---------------------------------------------------------------------------
// Strategy Analysis
// ---------------------------------------------------------------------------

export async function analyzeStrategy(req: StrategyAnalysisRequest): Promise<string> {
  const provider = AiProviderFactory.getProvider();
  const domains: ContextDomain[] = ["research", "risk"];

  const context = await buildContext({ accountId: req.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  const messages: LlmMessage[] = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "system", content: contextText },
    {
      role: "user",
      content: `Analyze the strategy "${req.strategyName}"${req.backtestRunId ? ` (backtest run ${req.backtestRunId})` : ""}.

Cover:
1. **Strategy strengths** — what conditions does it excel in?
2. **Strategy weaknesses** — where does it struggle?
3. **Drawdown behavior** — how does it behave during losing streaks?
4. **Win rate characteristics** — consistency and trade distribution
5. **Market suitability** — trending vs. ranging markets
6. **Risk profile** — volatility of returns, tail risk
7. **Expected conditions** — when should this strategy outperform?

Provide specific observations based on available backtest and risk data.`,
    },
  ];

  const llmResponse = await callProvider(provider, messages, "strategy.analyze");

  // Store as a summary
  const contextSnapshot = await createContextSnapshot({
    accountId: req.accountId,
    domains,
    researchData: context.researchData ?? null,
    riskData: context.riskData ?? null,
    dataPointCount: "2",
    contextSizeChars: String(context.contextSizeChars),
  });

  await createSummary({
    domain: "strategy",
    accountId: req.accountId,
    strategyName: req.strategyName,
    content: llmResponse.content,
    tone: "neutral",
    contextSnapshotId: contextSnapshot.id,
    provider: provider.name,
    model: llmResponse.model,
    promptTokens: String(llmResponse.usage.promptTokens),
    completionTokens: String(llmResponse.usage.completionTokens),
  });

  await recordAndAudit(provider, llmResponse, "strategy.analyze", req.accountId, domains);

  return llmResponse.content;
}

// ---------------------------------------------------------------------------
// Portfolio Analysis
// ---------------------------------------------------------------------------

export async function analyzePortfolio(req: PortfolioAnalysisRequest): Promise<string> {
  const provider = AiProviderFactory.getProvider();
  const domains: ContextDomain[] = req.domains ?? ["portfolio", "risk", "paper", "benchmark", "health", "recommendations"];

  const context = await buildContext({ accountId: req.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  const messages: LlmMessage[] = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "system", content: contextText },
    {
      role: "user",
      content: `Analyze the portfolio for account ${req.accountId}.

Cover:
1. **Portfolio performance** — TWR, MWR, risk-adjusted returns
2. **Allocation quality** — capital distribution across strategies and assets
3. **Concentration risks** — over-weighted positions or strategies
4. **Diversification quality** — HHI and correlation-adjusted analysis
5. **Benchmark performance** — alpha, beta, information ratio
6. **Capital efficiency** — idle capital, exposure utilization
7. **Portfolio health** — composite score and dimension breakdown

Provide specific observations from the available analytics data.`,
    },
  ];

  const llmResponse = await callProvider(provider, messages, "portfolio.analyze");

  const contextSnapshot = await createContextSnapshot({
    accountId: req.accountId,
    domains,
    portfolioData: context.portfolioData ?? null,
    riskData: context.riskData ?? null,
    paperData: context.paperData ?? null,
    benchmarkData: context.benchmarkData ?? null,
    healthData: context.healthData ?? null,
    recommendationData: context.recommendationData ?? null,
    dataPointCount: String(domains.length),
    contextSizeChars: String(context.contextSizeChars),
  });

  await createSummary({
    domain: "portfolio",
    accountId: req.accountId,
    content: llmResponse.content,
    tone: "neutral",
    contextSnapshotId: contextSnapshot.id,
    provider: provider.name,
    model: llmResponse.model,
    promptTokens: String(llmResponse.usage.promptTokens),
    completionTokens: String(llmResponse.usage.completionTokens),
  });

  await recordAndAudit(provider, llmResponse, "portfolio.analyze", req.accountId, domains);

  return llmResponse.content;
}

// ---------------------------------------------------------------------------
// Risk Analysis
// ---------------------------------------------------------------------------

export async function analyzeRisk(req: RiskAnalysisRequest): Promise<string> {
  const provider = AiProviderFactory.getProvider();
  const domains: ContextDomain[] = ["risk", "paper"];

  const context = await buildContext({ accountId: req.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  const eventFocus = req.focusEventId && req.focusEventType
    ? `\n\nFocus specifically on ${req.focusEventType} event ${req.focusEventId} and explain what triggered it and its implications.`
    : "";

  const messages: LlmMessage[] = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "system", content: contextText },
    {
      role: "user",
      content: `Explain the risk situation for this platform instance.${eventFocus}

Cover:
1. **Risk violations** — what rules were breached and why
2. **Circuit breaker events** — what triggered them and the implications
3. **Kill switch events** — scope and duration of any halts
4. **Exposure issues** — concentrated or excessive exposure
5. **Drawdown events** — cause, depth, and recovery status
6. **Overall portfolio risk** — how the current state relates to the configured risk profile

Note: This is an explanation only. The AI cannot modify or override any risk control.`,
    },
  ];

  const llmResponse = await callProvider(provider, messages, "risk.analyze");

  const contextSnapshot = await createContextSnapshot({
    accountId: req.accountId,
    domains,
    riskData: context.riskData ?? null,
    paperData: context.paperData ?? null,
    dataPointCount: "2",
    contextSizeChars: String(context.contextSizeChars),
  });

  await createExplanation({
    entityType: req.focusEventType ?? "risk_overview",
    entityId: req.focusEventId,
    title: `Risk Analysis${req.focusEventType ? ` — ${req.focusEventType}` : ""}`,
    explanation: llmResponse.content,
    accountId: req.accountId,
    contextSnapshotId: contextSnapshot.id,
    provider: provider.name,
    model: llmResponse.model,
  });

  await recordAndAudit(provider, llmResponse, "risk.analyze", req.accountId, domains);

  return llmResponse.content;
}

// ---------------------------------------------------------------------------
// Comparison Engine
// ---------------------------------------------------------------------------

export async function runComparison(req: ComparisonRequest): Promise<string> {
  const provider = AiProviderFactory.getProvider();

  const domainMap: Record<string, ContextDomain[]> = {
    strategy_vs_strategy: ["research", "risk"],
    portfolio_vs_benchmark: ["portfolio", "benchmark"],
    backtest_vs_paper: ["research", "paper"],
    risk_profile_vs_risk_profile: ["risk"],
  };

  const domains: ContextDomain[] = domainMap[req.type] ?? ["portfolio", "risk"];
  const context = await buildContext({ accountId: req.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  const comparisonPrompts: Record<string, string> = {
    strategy_vs_strategy: `Compare strategy "${req.leftId}" vs strategy "${req.rightId}". Focus on: Sharpe ratio, drawdown profile, win rate, profit factor, regime suitability, and which performs better in which conditions. Explain tradeoffs clearly.`,
    portfolio_vs_benchmark: `Compare portfolio "${req.leftId}" vs benchmark "${req.rightId}". Focus on: alpha generation, beta, information ratio, drawdown comparison, Sharpe ratio, and whether the active strategy adds value over passive holding.`,
    backtest_vs_paper: `Compare backtest run "${req.leftId}" vs paper trading run "${req.rightId}". Focus on: performance degradation from backtest to live, slippage differences, fill quality, and what accounts for any divergence.`,
    risk_profile_vs_risk_profile: `Compare risk profile "${req.leftId}" vs risk profile "${req.rightId}". Focus on: position size limits, exposure limits, daily loss limits, drawdown thresholds, and the implications of each profile for capital preservation.`,
  };

  const messages: LlmMessage[] = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "system", content: contextText },
    {
      role: "user",
      content: `${comparisonPrompts[req.type] ?? `Compare ${req.leftId} vs ${req.rightId}`}

Generate a narrative comparison with: Executive Summary, Side-by-Side Analysis, Key Differences, and Conclusion (which is more suitable for which conditions).`,
    },
  ];

  const llmResponse = await callProvider(provider, messages, "comparison.run");

  await recordAndAudit(provider, llmResponse, "comparison.run", req.accountId, domains);

  return llmResponse.content;
}

// ---------------------------------------------------------------------------
// Insight Generation
// ---------------------------------------------------------------------------

export async function generateInsights(opts: {
  accountId?: string;
  domains?: ContextDomain[];
}): Promise<number> {
  const provider = AiProviderFactory.getProvider();
  const domains: ContextDomain[] = opts.domains ?? ["portfolio", "risk", "health"];

  const context = await buildContext({ accountId: opts.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  const messages: LlmMessage[] = [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "system", content: contextText },
    {
      role: "user",
      content: `Based on the platform data, identify up to 5 key insights. For each insight return a JSON array with this structure:
[
  {
    "category": "performance|risk|diversification|strategy|benchmark|allocation",
    "severity": "info|warning|critical",
    "title": "short title",
    "explanation": "detailed explanation in plain English"
  }
]
Return ONLY the JSON array, no other text.`,
    },
  ];

  let llmResponse: Awaited<ReturnType<typeof provider.complete>>;
  try {
    llmResponse = await callProvider(provider, messages, "insight.generate");
  } catch (err) {
    logger.error({ err }, "Insight generation failed");
    return 0;
  }

  const contextSnapshot = await createContextSnapshot({
    accountId: opts.accountId,
    domains,
    portfolioData: context.portfolioData ?? null,
    riskData: context.riskData ?? null,
    healthData: context.healthData ?? null,
    dataPointCount: String(domains.length),
    contextSizeChars: String(context.contextSizeChars),
  });

  let insights: Array<{ category: string; severity: string; title: string; explanation: string }> = [];
  try {
    const raw = llmResponse.content.trim();
    // Try to extract JSON if it's wrapped in markdown code blocks
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
    insights = JSON.parse(jsonMatch[1] ?? raw);
  } catch (_) {
    // If parsing fails, store a single insight from the raw text
    insights = [{
      category: "performance",
      severity: "info",
      title: "Platform Insight",
      explanation: llmResponse.content,
    }];
  }

  let count = 0;
  for (const insight of insights.slice(0, 5)) {
    await createInsight({
      category: insight.category ?? "performance",
      severity: insight.severity ?? "info",
      title: insight.title ?? "Insight",
      explanation: insight.explanation ?? "",
      accountId: opts.accountId,
      contextSnapshotId: contextSnapshot.id,
      provider: provider.name,
    });
    count++;
  }

  await recordAndAudit(provider, llmResponse, "insight.generate", opts.accountId, domains);

  return count;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function callProvider(
  provider: ReturnType<typeof AiProviderFactory.getProvider>,
  messages: LlmMessage[],
  _operation: string,
): Promise<Awaited<ReturnType<typeof provider.complete>>> {
  return provider.complete(messages, { maxTokens: 2000, temperature: 0.25 });
}

async function recordAndAudit(
  provider: ReturnType<typeof AiProviderFactory.getProvider>,
  llmResponse: { model: string; usage: LlmUsage; latencyMs: number; content: string },
  action: string,
  accountId?: string,
  domains?: ContextDomain[],
): Promise<void> {
  await Promise.allSettled([
    recordUsageMetric({
      provider: provider.name,
      model: llmResponse.model,
      operationType: action,
      promptTokens: llmResponse.usage.promptTokens,
      completionTokens: llmResponse.usage.completionTokens,
      totalTokens: llmResponse.usage.totalTokens,
      estimatedCostUsd: String(llmResponse.usage.estimatedCostUsd ?? 0),
      latencyMs: llmResponse.latencyMs,
      status: "success",
    }),
    writeAiAuditLog({
      actor: "user",
      action,
      accountId,
      responseSummary: llmResponse.content.slice(0, 300),
      contextDomains: domains ?? [],
      provider: provider.name,
      model: llmResponse.model,
      promptTokens: llmResponse.usage.promptTokens,
      completionTokens: llmResponse.usage.completionTokens,
      latencyMs: llmResponse.latencyMs,
      result: "success",
    }),
  ]);
}
