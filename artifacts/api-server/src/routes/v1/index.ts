import { Router, type IRouter } from "express";
import marketsRouter from "./markets";
import candlesRouter from "./candles";
import latestPriceRouter from "./latest-price";
import ingestionStatusRouter from "./ingestion-status";
import ingestionJobsRouter from "./ingestion-jobs";
import providersRouter from "./providers";
import marketRegistryRouter from "./market-registry";
import dataQualityRouter from "./data-quality";
import economicEventsRouter from "./economic-events";
import newsRouter from "./news";
// Phase 3 — Research Laboratory
import researchStrategiesRouter from "./research-strategies";
import researchBacktestRouter from "./research-backtest";
import researchRunsRouter from "./research-runs";
import researchResultsRouter from "./research-results";
import researchCompareRouter from "./research-compare";
// Phase 4 — Professional Backtesting & Validation Engine
import researchPortfolioBacktestRouter from "./research-portfolio-backtest";
import researchWalkForwardRouter from "./research-walk-forward";
import researchMonteCarloRouter from "./research-monte-carlo";
import researchEquityCurveRouter from "./research-equity-curve";
import researchValidationRouter from "./research-validation";
import researchRankingsRouter from "./research-rankings";
// Phase 5 — Institutional Paper Trading Environment
import paperAccountsRouter from "./paper-accounts";
import paperStrategiesRouter from "./paper-strategies";
import paperOrdersRouter from "./paper-orders";
import paperPositionsRouter from "./paper-positions";
import paperFillsRouter from "./paper-fills";
import paperPortfolioRouter from "./paper-portfolio";
import paperPerformanceRouter from "./paper-performance";
import paperAlertsRouter from "./paper-alerts";
import paperSnapshotsRouter from "./paper-snapshots";
// Phase 6 — Institutional Risk Engine & Capital Protection Layer
import riskProfilesRouter from "./risk-profiles";
import riskDecisionsRouter from "./risk-decisions";
import riskEventsRouter from "./risk-events";
import riskCorrelationsRouter from "./risk-correlations";
import riskStrategiesRouter from "./risk-strategies";
import riskCircuitBreakersRouter from "./risk-circuit-breakers";
import riskKillSwitchRouter from "./risk-kill-switch";
import riskAuditRouter from "./risk-audit";
// Phase 7 — Portfolio Intelligence & Analytics Platform
import portfolioAnalyticsRouter from "./portfolio-analytics";
import portfolioPerformanceRouter from "./portfolio-performance";
import portfolioHealthRouter from "./portfolio-health";
import portfolioAttributionRouter from "./portfolio-attribution";
import portfolioBenchmarksRouter from "./portfolio-benchmarks";
import portfolioDiversificationRouter from "./portfolio-diversification";
import portfolioAllocationRouter from "./portfolio-allocation";
import portfolioRecommendationsRouter from "./portfolio-recommendations";
import portfolioRankingsRouter from "./portfolio-rankings";
import portfolioAuditRouter from "./portfolio-audit";
// Phase 8 — AI Research Assistant & Quant Intelligence Layer
import aiChatRouter from "./ai-chat";
import aiReportsRouter from "./ai-reports";
import aiInsightsRouter from "./ai-insights";
import aiSummariesRouter from "./ai-summaries";
import aiContextRouter from "./ai-context";
import aiUsageRouter from "./ai-usage";
import aiAuditRouter from "./ai-audit";
import aiComparisonRouter from "./ai-comparison";
// Phase 9 — Real-Time Market Streaming & Event Infrastructure
import streamStatusRouter from "./stream-status";
import marketTicksRouter from "./market-ticks-route";
import marketOrderbookRouter from "./market-orderbook-route";
import marketStateRouter from "./market-state-route";
import replayRouter from "./replay-route";
// Phase 10 — Institutional Execution Engine
import executionOrdersRouter from "./execution-orders";
import executionFillsRouter from "./execution-fills";
import executionPositionsRouter from "./execution-positions";
import executionRejectionsRouter from "./execution-rejections";
import executionStatusRouter from "./execution-status";

const v1Router: IRouter = Router();

// Phase 1 endpoints (preserved)
v1Router.use(marketsRouter);
v1Router.use(candlesRouter);
v1Router.use(latestPriceRouter);
v1Router.use(ingestionStatusRouter);

// Phase 2 endpoints
v1Router.use(ingestionJobsRouter);
v1Router.use(providersRouter);
v1Router.use(marketRegistryRouter);
v1Router.use(dataQualityRouter);
v1Router.use(economicEventsRouter);
v1Router.use(newsRouter);

// Phase 3 endpoints
v1Router.use(researchStrategiesRouter);
v1Router.use(researchBacktestRouter);
v1Router.use(researchRunsRouter);
v1Router.use(researchResultsRouter);
v1Router.use(researchCompareRouter);

// Phase 4 endpoints
v1Router.use(researchPortfolioBacktestRouter);
v1Router.use(researchWalkForwardRouter);
v1Router.use(researchMonteCarloRouter);
v1Router.use(researchEquityCurveRouter);
v1Router.use(researchValidationRouter);
v1Router.use(researchRankingsRouter);

// Phase 5 endpoints
v1Router.use(paperAccountsRouter);
v1Router.use(paperStrategiesRouter);
v1Router.use(paperOrdersRouter);
v1Router.use(paperPositionsRouter);
v1Router.use(paperFillsRouter);
v1Router.use(paperPortfolioRouter);
v1Router.use(paperPerformanceRouter);
v1Router.use(paperAlertsRouter);
v1Router.use(paperSnapshotsRouter);

// Phase 6 endpoints
v1Router.use(riskProfilesRouter);
v1Router.use(riskDecisionsRouter);
v1Router.use(riskEventsRouter);
v1Router.use(riskCorrelationsRouter);
v1Router.use(riskStrategiesRouter);
v1Router.use(riskCircuitBreakersRouter);
v1Router.use(riskKillSwitchRouter);
v1Router.use(riskAuditRouter);

// Phase 7 endpoints
v1Router.use(portfolioAnalyticsRouter);
v1Router.use(portfolioPerformanceRouter);
v1Router.use(portfolioHealthRouter);
v1Router.use(portfolioAttributionRouter);
v1Router.use(portfolioBenchmarksRouter);
v1Router.use(portfolioDiversificationRouter);
v1Router.use(portfolioAllocationRouter);
v1Router.use(portfolioRecommendationsRouter);
v1Router.use(portfolioRankingsRouter);
v1Router.use(portfolioAuditRouter);

// Phase 8 endpoints — AI Research Assistant
v1Router.use(aiChatRouter);
v1Router.use(aiReportsRouter);
v1Router.use(aiInsightsRouter);
v1Router.use(aiSummariesRouter);
v1Router.use(aiContextRouter);
v1Router.use(aiUsageRouter);
v1Router.use(aiAuditRouter);
v1Router.use(aiComparisonRouter);

// Phase 9 endpoints — Real-Time Market Streaming & Event Infrastructure
v1Router.use(streamStatusRouter);
v1Router.use(marketTicksRouter);
v1Router.use(marketOrderbookRouter);
v1Router.use(marketStateRouter);
v1Router.use(replayRouter);

// Phase 10 endpoints — Institutional Execution Engine
v1Router.use(executionOrdersRouter);
v1Router.use(executionFillsRouter);
v1Router.use(executionPositionsRouter);
v1Router.use(executionRejectionsRouter);
v1Router.use(executionStatusRouter);

export default v1Router;
