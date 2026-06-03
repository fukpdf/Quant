/**
 * intelligence-types.ts — shared TypeScript types for Phase 11 Intelligence Layer.
 *
 * All intelligence services, engines, and routes reference these types.
 * No business logic here — types, interfaces, and enums only.
 *
 * Advisory boundary: this layer produces research findings and recommendations.
 * It does NOT execute trades, override risk controls, or approve orders.
 */

// ---------------------------------------------------------------------------
// Market Regime Types
// ---------------------------------------------------------------------------

export type RegimeType =
  | "bull"
  | "bear"
  | "sideways"
  | "high_volatility"
  | "low_volatility";

export const REGIME_TYPES: RegimeType[] = [
  "bull",
  "bear",
  "sideways",
  "high_volatility",
  "low_volatility",
];

export type RegimeStatus = "active" | "closed" | "superseded";
export type DetectionMethod = "heuristic" | "ml" | "ensemble";

export interface RegimeIndicators {
  trend_slope: number;       // Slope of linear regression on close prices
  volatility_pct: number;    // Annualized rolling volatility %
  adx: number;               // Average directional index (0–100)
  rsi_avg: number;           // Average RSI over lookback window
  volume_ratio: number;      // Recent volume / baseline volume
  return_pct: number;        // Total return % over lookback window
}

export interface DetectedRegime {
  symbol: string;
  regimeType: RegimeType;
  confidenceScore: number;
  indicators: RegimeIndicators;
  detectionMethod: DetectionMethod;
  lookbackDays: number;
}

// ---------------------------------------------------------------------------
// Optimization Types
// ---------------------------------------------------------------------------

export type OptimizationMethod =
  | "grid_search"
  | "random_search"
  | "bayesian"
  | "genetic";

export type OptimizationObjective =
  | "sharpe"
  | "calmar"
  | "total_return"
  | "sortino"
  | "profit_factor";

export type OptimizationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface ParameterRange {
  min: number;
  max: number;
  step?: number;
  type?: "int" | "float";
  values?: (number | string)[];  // For categorical parameters
}

export type ParameterSpace = Record<string, ParameterRange>;

export interface OptimizationConfig {
  strategyName: string;
  method: OptimizationMethod;
  objective: OptimizationObjective;
  parameterSpace: ParameterSpace;
  symbol: string;
  timeframe: string;
  startDate: string;
  endDate: string;
  maxIterations?: number;
  /** For genetic */
  populationSize?: number;
  maxGenerations?: number;
  mutationRate?: number;
  crossoverRate?: number;
  elitismCount?: number;
  /** For Bayesian */
  explorationTrials?: number;
}

export interface OptimizationTrialResult {
  parameters: Record<string, number>;
  score: number;
  sharpeRatio: number;
  sortinoRatio: number;
  totalReturn: number;
  maxDrawdown: number;
  winRate: number;
  tradeCount: number;
  profitFactor: number;
  evaluationMs: number;
}

// ---------------------------------------------------------------------------
// Genetic Evolution Types
// ---------------------------------------------------------------------------

export type MutationType = "parameter_tweak" | "crossover" | "random" | "elitism";

export interface Individual {
  id?: string;
  parameters: Record<string, number>;
  fitness?: number;
  sharpeRatio?: number;
  totalReturn?: number;
  maxDrawdown?: number;
  tradeCount?: number;
  rank?: number;
}

export interface Population {
  populationId: string;
  strategyName: string;
  generationNumber: number;
  individuals: Individual[];
  bestFitness?: number;
  avgFitness?: number;
  diversityScore?: number;
}

// ---------------------------------------------------------------------------
// Portfolio Allocation Types
// ---------------------------------------------------------------------------

export type AllocationMethod =
  | "equal_weight"
  | "risk_parity"
  | "volatility_targeting"
  | "sharpe_maximization"
  | "kelly";

export interface StrategyProfile {
  name: string;
  sharpeRatio: number;
  sortinoRatio: number;
  totalReturn: number;
  maxDrawdown: number;
  volatility: number;
  winRate: number;
  avgReturn: number;
  tradeCount: number;
}

export interface AllocationConstraints {
  minWeight?: number;          // Minimum weight per strategy (default 0.05)
  maxWeight?: number;          // Maximum weight per strategy (default 0.5)
  targetVolatility?: number;   // For volatility_targeting method
  kellyFraction?: number;      // Kelly fraction multiplier (default 0.5 = half-Kelly)
  maxStrategies?: number;      // Maximum strategies to include
}

export interface ComputedAllocation {
  method: AllocationMethod;
  targetWeights: Record<string, number>;
  actualWeights: Record<string, number>;
  kellyFractions: Record<string, number>;
  riskContributions: Record<string, number>;
  expectedSharpe: number;
  expectedReturn: number;
  expectedVolatility: number;
  expectedMaxDrawdown: number;
  diversificationRatio: number;
}

// ---------------------------------------------------------------------------
// Ranking Types
// ---------------------------------------------------------------------------

export type RankingPeriod = "daily" | "weekly" | "monthly" | "all_time";

export interface RankingFactors {
  sharpeScore: number;
  sortinoScore: number;
  calmarScore: number;
  maxDrawdownScore: number;
  winRateScore: number;
  consistencyScore: number;
  walkForwardScore: number;
  monteCarloScore: number;
}

/** Factor weights for composite score computation (must sum to 1) */
export const RANKING_WEIGHTS: Record<keyof RankingFactors, number> = {
  sharpeScore: 0.25,
  sortinoScore: 0.15,
  calmarScore: 0.15,
  maxDrawdownScore: 0.10,
  winRateScore: 0.10,
  consistencyScore: 0.10,
  walkForwardScore: 0.10,
  monteCarloScore: 0.05,
};

export interface StrategyRankingResult {
  strategyName: string;
  compositeScore: number;
  rankPosition: number;
  totalStrategies: number;
  percentile: number;
  factors: RankingFactors;
  rawMetrics: {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    totalReturn: number;
    winRate: number;
    tradeCount: number;
  };
}

// ---------------------------------------------------------------------------
// Cluster Types
// ---------------------------------------------------------------------------

export type ClusterMethod = "correlation" | "performance" | "regime" | "combined";

export interface ClusterResult {
  clusterName: string;
  strategyNames: string[];
  centroid: Record<string, number>;
  avgCorrelation: number;
  avgSharpe: number;
  avgMaxDrawdown: number;
  diversificationScore: number;
  silhouetteScore: number;
  regimeAffinity: Record<RegimeType, number>;
}

// ---------------------------------------------------------------------------
// AI Research Job Types
// ---------------------------------------------------------------------------

export type ResearchJobType =
  | "strategy_analysis"
  | "optimization_recommendation"
  | "regime_adaptation"
  | "parameter_suggestion"
  | "overfitting_detection"
  | "portfolio_review"
  | "comparative_analysis";

export type ResearchJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type ResearchJobPriority = "low" | "medium" | "high" | "critical";

export type FindingType =
  | "insight"
  | "recommendation"
  | "warning"
  | "overfitting"
  | "parameter_change"
  | "regime_alert";

export type FindingSeverity = "info" | "warning" | "critical";

export interface ResearchFinding {
  findingType: FindingType;
  severity: FindingSeverity;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  suggestedActions: string[];
  confidenceScore: number;
}

// ---------------------------------------------------------------------------
// Continuous Learning Types
// ---------------------------------------------------------------------------

export interface LearningMetrics {
  totalOptimizationRuns: number;
  successfulRuns: number;
  avgImprovementDelta: number;
  bestStrategyFound: string | null;
  regimesDetected: number;
  rankingsComputed: number;
  clustersIdentified: number;
  aiJobsCompleted: number;
  findingsGenerated: number;
}

// ---------------------------------------------------------------------------
// Intelligence Status
// ---------------------------------------------------------------------------

export interface IntelligenceStatus {
  regimeDetection: { active: boolean; lastRunAt: string | null; activeRegimes: number };
  optimizer: { running: boolean; queueDepth: number; completedToday: number };
  geneticEngine: { populationsActive: number; generationsEvolvedToday: number };
  portfolioAllocator: { activeAllocation: string | null; lastComputedAt: string | null };
  rankingEngine: { lastComputedAt: string | null; strategiesRanked: number };
  correlationEngine: { lastComputedAt: string | null; clustersActive: number };
  researchCoordinator: { pendingJobs: number; runningJobs: number; completedToday: number };
  learningEngine: { metricsSnapshot: LearningMetrics };
}
