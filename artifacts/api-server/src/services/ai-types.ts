/**
 * ai-types.ts — shared TypeScript types for the Phase 8 AI layer.
 *
 * SAFETY BOUNDARY:
 * AI is advisory only. It may NOT: execute trades, approve orders, reject orders,
 * override risk controls, bypass circuit breakers, or control capital.
 * These types enforce that boundary — no execution or override types are defined here.
 */

// ---------------------------------------------------------------------------
// Provider Abstraction
// ---------------------------------------------------------------------------

export type LlmProviderName = "openai" | "anthropic" | "gemini" | "mock";

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmRequestOptions {
  /** Max tokens to generate */
  maxTokens?: number;
  /** Temperature 0–1 */
  temperature?: number;
  /** Model override (defaults to provider default) */
  model?: string;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Estimated cost in USD — provider-calculated */
  estimatedCostUsd?: number;
}

export interface LlmResponse {
  content: string;
  model: string;
  provider: LlmProviderName;
  usage: LlmUsage;
  /** Latency in milliseconds */
  latencyMs: number;
}

/** Core provider interface — all providers implement this */
export interface ILlmProvider {
  readonly name: LlmProviderName;
  readonly defaultModel: string;
  complete(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse>;
}

// ---------------------------------------------------------------------------
// AI Context
// ---------------------------------------------------------------------------

export type ContextDomain = "portfolio" | "risk" | "paper" | "research" | "benchmark" | "health" | "recommendations";

export interface AiContext {
  domains: ContextDomain[];
  accountId?: string;
  portfolioData?: PortfolioContextData;
  riskData?: RiskContextData;
  paperData?: PaperContextData;
  researchData?: ResearchContextData;
  benchmarkData?: BenchmarkContextData;
  healthData?: HealthContextData;
  recommendationData?: RecommendationContextData;
  /** ISO timestamp when context was built */
  builtAt: string;
  /** Approximate context size in characters */
  contextSizeChars: number;
}

export interface PortfolioContextData {
  analytics?: Record<string, unknown>;
  performance?: Record<string, unknown>;
  attribution?: Record<string, unknown>;
  diversification?: Record<string, unknown>;
  allocation?: Record<string, unknown>;
  periods?: Record<string, unknown>[];
}

export interface RiskContextData {
  profile?: Record<string, unknown>;
  recentDecisions?: Record<string, unknown>[];
  recentEvents?: Record<string, unknown>[];
  violations?: Record<string, unknown>[];
  circuitBreakers?: Record<string, unknown>;
  killSwitchStatus?: Record<string, unknown>;
  drawdownEvents?: Record<string, unknown>[];
  strategyRiskScores?: Record<string, unknown>[];
}

export interface PaperContextData {
  account?: Record<string, unknown>;
  portfolio?: Record<string, unknown>;
  openPositions?: Record<string, unknown>[];
  recentTrades?: Record<string, unknown>[];
  performance?: Record<string, unknown>;
  alerts?: Record<string, unknown>[];
}

export interface ResearchContextData {
  strategies?: Record<string, unknown>[];
  topRuns?: Record<string, unknown>[];
  rankings?: Record<string, unknown>[];
  validationResults?: Record<string, unknown>[];
}

export interface BenchmarkContextData {
  benchmarks?: Record<string, unknown>[];
  snapshots?: Record<string, unknown>[];
}

export interface HealthContextData {
  score?: number;
  grade?: string;
  dimensions?: Record<string, unknown>;
  history?: Record<string, unknown>[];
}

export interface RecommendationContextData {
  active?: Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatRequest {
  /** User question in plain text */
  question: string;
  /** Conversation ID to continue (omit to start new conversation) */
  conversationId?: string;
  /** Account ID to scope context */
  accountId?: string;
  /** Which domains to include in context */
  domains?: ContextDomain[];
}

export interface ChatResponse {
  conversationId: string;
  queryId: string;
  answer: string;
  provider: LlmProviderName;
  model: string;
  usage: LlmUsage;
  contextDomains: ContextDomain[];
}

// ---------------------------------------------------------------------------
// Report Generation
// ---------------------------------------------------------------------------

export type ReportType =
  | "portfolio"
  | "strategy"
  | "risk"
  | "performance"
  | "benchmark"
  | "health"
  | "diversification"
  | "allocation"
  | "daily"
  | "weekly"
  | "monthly"
  | "research";

export interface ReportRequest {
  reportType: ReportType;
  accountId?: string;
  strategyName?: string;
  period?: "daily" | "weekly" | "monthly" | "custom";
  periodStart?: string;
  periodEnd?: string;
  domains?: ContextDomain[];
}

export interface ReportResult {
  reportId: string;
  title: string;
  content: string;
  reportType: ReportType;
  provider: LlmProviderName;
  model: string;
  usage: LlmUsage;
}

// ---------------------------------------------------------------------------
// Analysis requests
// ---------------------------------------------------------------------------

export interface StrategyAnalysisRequest {
  strategyName: string;
  backtestRunId?: string;
  accountId?: string;
}

export interface PortfolioAnalysisRequest {
  accountId: string;
  domains?: ContextDomain[];
}

export interface RiskAnalysisRequest {
  accountId?: string;
  focusEventId?: string;
  focusEventType?: string;
}

export interface ComparisonRequest {
  type: "strategy_vs_strategy" | "portfolio_vs_benchmark" | "backtest_vs_paper" | "risk_profile_vs_risk_profile";
  leftId: string;
  rightId: string;
  accountId?: string;
}
