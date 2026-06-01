import { AiProviderFactory } from "./ai-provider-factory";
import { buildContext, formatContextAsPrompt } from "./ai-context-builder";
import {
  createReport,
  createContextSnapshot,
  recordUsageMetric,
  writeAiAuditLog,
} from "./ai-db";
import type {
  ReportRequest,
  ReportResult,
  ReportType,
  LlmMessage,
  ContextDomain,
} from "./ai-types";
import { logger } from "../lib/logger";

/**
 * AI Report Engine — generates structured analytical reports from platform data.
 *
 * Reports are reproducible: each stores the context snapshot ID so the same data
 * can be retrieved later. Reports are markdown documents targeting human operators.
 *
 * SAFETY: Reports are descriptive only. No trade recommendations.
 */

const REPORT_SYSTEM_PROMPT = `You are a quantitative research analyst generating a structured report for a systematic trading platform.

Reports must:
- Be factual and data-driven based ONLY on the provided platform context
- Use markdown formatting with clear sections and headers
- Explain metrics in plain English (define abbreviations on first use)
- Highlight key findings, trends, and anomalies
- Note data freshness limitations when relevant
- Never recommend specific trades, entries, exits, or position sizes
- Never claim to predict future performance

Structure reports with: Executive Summary, Key Metrics, Detailed Analysis, and Notable Observations.`;

const REPORT_PROMPTS: Record<ReportType, string> = {
  portfolio: "Generate a comprehensive PORTFOLIO REPORT covering: overall equity, performance attribution, strategy contributions, position summary, drawdown status, and capital efficiency.",
  strategy: "Generate a STRATEGY ANALYSIS REPORT covering: strategy characteristics, win rate, profit factor, drawdown profile, regime suitability, and comparison to other registered strategies.",
  risk: "Generate a RISK REVIEW REPORT covering: recent risk decisions (approved/rejected), violations, circuit breaker events, kill switch events, drawdown events, and current risk profile compliance.",
  performance: "Generate a PERFORMANCE REVIEW REPORT covering: time-weighted returns, risk-adjusted metrics (Sharpe, Sortino, Calmar), benchmark alpha and beta, maximum drawdown, and period comparisons.",
  benchmark: "Generate a BENCHMARK COMPARISON REPORT covering: portfolio vs. benchmark performance, alpha generation, beta exposure, information ratio, and tracking error.",
  health: "Generate a PORTFOLIO HEALTH REPORT covering: composite health score, dimension breakdown (diversification/performance/risk/activity/drawdown), grade interpretation, and what is dragging the score.",
  diversification: "Generate a DIVERSIFICATION REPORT covering: Herfindahl-Hirschman Index, asset concentration, strategy concentration, correlation-adjusted diversification score, and what changes would improve diversification.",
  allocation: "Generate an ALLOCATION REPORT covering: current capital distribution, target vs. actual weights, drift analysis, idle capital, and rebalancing triggers.",
  daily: "Generate a DAILY SUMMARY REPORT covering: today's P&L, risk events, portfolio state, active positions, and any alerts fired in the past 24 hours.",
  weekly: "Generate a WEEKLY SUMMARY REPORT covering: 7-day returns, week's best/worst strategies, risk events, benchmark comparison for the week, and key observations.",
  monthly: "Generate a MONTHLY REPORT covering: monthly returns, strategy rankings, risk events, benchmark outperformance/underperformance, health score trend, and recommendations.",
  research: "Generate a RESEARCH SUMMARY REPORT covering: registered strategies, top-performing backtest runs, validation grades, walk-forward results, and strategy improvement opportunities.",
};

const REPORT_DOMAIN_MAP: Record<ReportType, ContextDomain[]> = {
  portfolio: ["portfolio", "paper", "health", "recommendations"],
  strategy: ["research", "risk"],
  risk: ["risk", "paper"],
  performance: ["portfolio", "benchmark"],
  benchmark: ["portfolio", "benchmark"],
  health: ["health", "portfolio", "risk"],
  diversification: ["portfolio", "risk"],
  allocation: ["portfolio", "recommendations"],
  daily: ["portfolio", "risk", "paper", "health"],
  weekly: ["portfolio", "risk", "paper", "benchmark", "health"],
  monthly: ["portfolio", "risk", "paper", "benchmark", "health", "recommendations"],
  research: ["research"],
};

export async function generateReport(req: ReportRequest): Promise<ReportResult> {
  const provider = AiProviderFactory.getProvider();
  const domains: ContextDomain[] = req.domains ?? REPORT_DOMAIN_MAP[req.reportType] ?? ["portfolio", "risk"];

  // Build context
  const context = await buildContext({ accountId: req.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  // Store context snapshot
  const contextSnapshot = await createContextSnapshot({
    accountId: req.accountId,
    domains,
    portfolioData: context.portfolioData ?? null,
    riskData: context.riskData ?? null,
    paperData: context.paperData ?? null,
    researchData: context.researchData ?? null,
    benchmarkData: context.benchmarkData ?? null,
    healthData: context.healthData ?? null,
    recommendationData: context.recommendationData ?? null,
    dataPointCount: String(domains.length),
    contextSizeChars: String(context.contextSizeChars),
  });

  const reportPrompt = REPORT_PROMPTS[req.reportType];
  const title = buildReportTitle(req);

  const periodNote = req.period
    ? `\nReport period: ${req.period}${req.periodStart ? ` (${req.periodStart} to ${req.periodEnd ?? "now"})` : ""}`
    : "";

  const strategyNote = req.strategyName
    ? `\nStrategy focus: ${req.strategyName}`
    : "";

  const messages: LlmMessage[] = [
    { role: "system", content: REPORT_SYSTEM_PROMPT },
    { role: "system", content: contextText },
    {
      role: "user",
      content: `${reportPrompt}${periodNote}${strategyNote}\n\nTitle: ${title}\n\nGenerate the full report now.`,
    },
  ];

  let llmResponse: Awaited<ReturnType<typeof provider.complete>>;
  try {
    llmResponse = await provider.complete(messages, {
      maxTokens: 2500,
      temperature: 0.2,
    });
  } catch (err) {
    logger.error({ err, reportType: req.reportType }, "Report generation LLM error");

    await writeAiAuditLog({
      actor: "user",
      action: "report.generate",
      accountId: req.accountId,
      promptSummary: `${req.reportType} report`,
      contextDomains: domains,
      provider: provider.name,
      model: provider.defaultModel,
      promptTokens: 0,
      completionTokens: 0,
      result: "failure",
      errorMessage: String(err),
    });

    throw new Error(`Report generation failed: ${String(err)}`);
  }

  // Persist report
  const report = await createReport({
    reportType: req.reportType,
    title,
    accountId: req.accountId,
    strategyName: req.strategyName,
    period: req.period,
    periodStart: req.periodStart,
    periodEnd: req.periodEnd,
    content: llmResponse.content,
    contextSnapshotId: contextSnapshot.id,
    provider: provider.name,
    model: llmResponse.model,
    promptTokens: String(llmResponse.usage.promptTokens),
    completionTokens: String(llmResponse.usage.completionTokens),
    status: "completed",
    generationParams: { reportType: req.reportType, domains, periodNote, strategyNote },
  });

  // Usage metric
  await recordUsageMetric({
    provider: provider.name,
    model: llmResponse.model,
    operationType: "report",
    reportId: report.id,
    promptTokens: llmResponse.usage.promptTokens,
    completionTokens: llmResponse.usage.completionTokens,
    totalTokens: llmResponse.usage.totalTokens,
    estimatedCostUsd: String(llmResponse.usage.estimatedCostUsd ?? 0),
    latencyMs: llmResponse.latencyMs,
    status: "success",
  });

  // Audit log
  await writeAiAuditLog({
    actor: "user",
    action: "report.generate",
    accountId: req.accountId,
    reportId: report.id,
    promptSummary: `${req.reportType} report: ${title}`,
    responseSummary: llmResponse.content.slice(0, 300),
    contextDomains: domains,
    provider: provider.name,
    model: llmResponse.model,
    promptTokens: llmResponse.usage.promptTokens,
    completionTokens: llmResponse.usage.completionTokens,
    latencyMs: llmResponse.latencyMs,
    result: "success",
  });

  return {
    reportId: report.id,
    title,
    content: llmResponse.content,
    reportType: req.reportType,
    provider: provider.name,
    model: llmResponse.model,
    usage: llmResponse.usage,
  };
}

function buildReportTitle(req: ReportRequest): string {
  const typeLabels: Record<ReportType, string> = {
    portfolio: "Portfolio Report",
    strategy: "Strategy Analysis Report",
    risk: "Risk Review",
    performance: "Performance Review",
    benchmark: "Benchmark Comparison Report",
    health: "Portfolio Health Report",
    diversification: "Diversification Analysis",
    allocation: "Allocation Report",
    daily: "Daily Summary",
    weekly: "Weekly Summary",
    monthly: "Monthly Report",
    research: "Research Summary",
  };

  const base = typeLabels[req.reportType] ?? "Report";
  const strategy = req.strategyName ? ` — ${req.strategyName}` : "";
  const period = req.periodStart ? ` (${req.periodStart})` : "";
  return `${base}${strategy}${period}`;
}
