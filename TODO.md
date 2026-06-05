# TODO.md — QuantForge Phased Roadmap

> Last updated: 2026-06-05
> Current phase: **Stabilization Sprint** ✅ COMPLETE — platform fully operational, all runtime errors fixed, browser preview verified

---

## Phase 0 — Repository Foundation ✅ COMPLETE

**Goal**: Create the operating environment, documentation system, development workflow, and security structure.

### Documentation & Structure
- [x] Create README.md with project overview and vision
- [x] Create PROJECT_MASTER.md (project brain)
- [x] Create AGENTS.md (AI agent operating instructions)
- [x] Create RULES.md (development rules and standards)
- [x] Create TODO.md (this file — phased roadmap)
- [x] Create CHANGELOG.md (change history)
- [x] Create DECISIONS.md (architecture decision records)
- [x] Create SECURITY.md (security policy)
- [x] Create CONTRIBUTING.md (contribution guidelines)
- [x] Create .env.example (environment variable template)
- [x] Create .gitignore

### Directory Skeleton
- [x] Create /docs directory with placeholder documents
- [x] Create /frontend directory with README
- [x] Create /backend directory with README
- [x] Create /database directory with README
- [x] Create /strategies directory with README
- [x] Create /tests directory with README
- [x] Create /scripts directory with README
- [x] Create /infrastructure directory with README

### Deep Documentation
- [x] docs/01-VISION.md
- [x] docs/02-PRODUCT_REQUIREMENTS.md
- [x] docs/03-TECHNICAL_REQUIREMENTS.md
- [x] docs/04-SYSTEM_ARCHITECTURE.md
- [x] docs/05-DATABASE_ARCHITECTURE.md
- [x] docs/06-SECURITY_ARCHITECTURE.md
- [x] docs/07-RISK_MANAGEMENT.md
- [x] docs/08-TRADING_RESEARCH.md
- [x] docs/09-API_STRATEGY.md
- [x] docs/10-IMPLEMENTATION_PLAN.md

### GitHub Preparation
- [x] Create .github/ directory
- [x] Create .github/ISSUE_TEMPLATE/bug_report.md
- [x] Create .github/ISSUE_TEMPLATE/feature_request.md
- [x] Create .github/PULL_REQUEST_TEMPLATE.md

---

## Phase 1 — Market Data Platform ✅ COMPLETE

**Goal**: Establish reliable, normalized market data ingestion across all asset classes.

### Data Provider Integrations
- [x] Research and select crypto data provider (Binance selected)
- [x] Document provider selection in DECISIONS.md

### Data Ingestion
- [x] Design data ingestion architecture
- [x] Implement REST polling for Binance
- [x] Implement connection health monitoring

### Data Normalization
- [x] Define unified OHLCV schema
- [x] Implement normalization layer

### API Endpoints (Phase 1)
- [x] `GET /v1/markets` — list available markets
- [x] `GET /v1/candles` — fetch OHLCV data
- [x] `GET /v1/latest-price` — fetch latest price
- [x] `GET /v1/ingestion/status` — ingestion log status

---

## Phase 2 — Multi-Market Architecture ✅ COMPLETE

**Goal**: Expand to multi-provider, multi-asset-class architecture.

### Schema Design
- [x] `markets` table
- [x] `candles` table (OHLCV)
- [x] `ingestion_jobs` table (structured run tracking)
- [x] `ingestion_logs` table (legacy Phase 1 logs)
- [x] `market_providers` table
- [x] `provider_health` table
- [x] `data_quality_checks` table
- [x] `economic_events` table
- [x] `news_items` table
- [x] `market_metadata` table

### API Endpoints (Phase 2)
- [x] `GET /v1/ingestion/jobs` — structured job list
- [x] `GET /v1/providers` — provider registry
- [x] `GET /v1/providers/health` — provider health records
- [x] `GET /v1/market-registry` — enriched market registry
- [x] `GET /v1/data-quality` — data quality checks
- [x] `GET /v1/economic-events` — economic calendar
- [x] `GET /v1/news` — financial news

---

## Phase 3 — Research Laboratory ✅ COMPLETE

**Goal**: Provide a professional quantitative research and backtesting environment.

### Database Tables
- [x] `strategy_definitions` — registered strategy catalog with parameter schemas
- [x] `strategy_versions` — immutable version history of strategy parameter schemas
- [x] `backtest_runs` — one row per backtest execution with full lifecycle tracking
- [x] `backtest_trades` — simulated trades produced by the engine
- [x] `performance_metrics` — risk-adjusted performance metrics per completed run

### Strategy Framework
- [x] `IStrategy` interface (types.ts)
- [x] `BaseStrategy` abstract class
- [x] Indicator library: EMA, SMA, RSI, MACD, Bollinger Bands
- [x] `EmaCrossoverStrategy` (ema_crossover)
- [x] `RsiMeanReversionStrategy` (rsi_mean_reversion)
- [x] `MacdTrendStrategy` (macd_trend)
- [x] `BollingerBandsStrategy` (bollinger_bands)
- [x] Strategy registry with pluggable factory pattern

### Backtesting Engine
- [x] Historical candle replay (chronological, no look-ahead bias)
- [x] Signal execution at NEXT candle open (realistic fill simulation)
- [x] Long-only, one-position-at-a-time position model
- [x] Mark-to-market equity curve generation
- [x] Force-close open position at end of backtest window

### Performance Metrics
- [x] Total Return, CAGR, Win Rate, Profit Factor, Avg Win/Loss
- [x] Maximum Drawdown, Sharpe Ratio, Sortino Ratio
- [x] Trade Count, Expectancy

### Research Infrastructure
- [x] Research runner service (executeBacktest)
- [x] Strategy definitions auto-seeded to DB on startup
- [x] Comparison engine (side-by-side multi-run comparison)

### API Endpoints (Phase 3)
- [x] `GET /v1/research/strategies`
- [x] `POST /v1/research/backtest`
- [x] `GET /v1/research/backtest/:id`
- [x] `GET /v1/research/runs`
- [x] `GET /v1/research/results`
- [x] `GET /v1/research/compare`

---

## Phase 4 — Professional Backtesting & Validation Engine ✅ COMPLETE

**Goal**: Institutional-grade backtesting with realistic cost modeling, professional risk metrics, portfolio simulation, and statistical validation.

### Database Tables (8 new)
- [x] `trade_cost_models`, `position_sizing_profiles`, `portfolio_backtests`, `equity_curves`
- [x] `walk_forward_runs`, `monte_carlo_runs`, `validation_results`, `research_snapshots`

### Core Features
- [x] Cost modeling (commission + slippage, 5 exchange presets)
- [x] Position sizing (5 methods including Kelly)
- [x] Advanced metrics (Calmar, Ulcer, MAR, UPI)
- [x] Portfolio engine (multi-symbol)
- [x] Walk-forward validation (rolling and expanding)
- [x] Monte Carlo analysis (trade shuffling)
- [x] Validation engine (A–F grading)

### API Endpoints (Phase 4)
- [x] 10 new endpoints under `/v1/research/`

---

## Phase 5 — Institutional Paper Trading Environment ✅ COMPLETE

**Goal**: Real-time strategy execution simulation against live market data.

### Database Tables (10 new)
- [x] `paper_accounts`, `paper_portfolios`, `paper_positions`, `paper_orders`, `paper_fills`
- [x] `paper_executions`, `paper_trade_history`, `paper_daily_snapshots`
- [x] `paper_strategy_assignments`, `paper_alerts`

### Core Services (9 new)
- [x] Execution engine, position manager, portfolio tracker, performance service
- [x] Alert manager, snapshot service, signal engine, scheduler

### API Endpoints (Phase 5)
- [x] 15 endpoints under `/v1/paper/`

---

## Phase 6 — Institutional Risk Engine & Capital Protection Layer ✅ COMPLETE

**Goal**: Pre-trade risk gatekeeper enforcing position sizing, exposure limits, and drawdown circuit breakers.

### Database Tables (12 new)
- [x] `risk_profiles`, `risk_rules`, `risk_decisions`, `risk_events`, `risk_violations`
- [x] `portfolio_risk_snapshots`, `strategy_risk_scores`, `correlation_matrices`
- [x] `drawdown_events`, `circuit_breaker_events`, `kill_switch_events`, `risk_audit_log`

### Core Services (9 new)
- [x] Risk engine (13 sequential checks), kill switch, circuit breakers
- [x] Correlation engine, strategy risk scorer, drawdown monitor, risk scheduler

### API Endpoints (Phase 6)
- [x] 20 endpoints under `/v1/risk/`

---

## Phase 7 — Portfolio Intelligence & Analytics Platform ✅ COMPLETE

**Goal**: Comprehensive performance measurement, attribution, health scoring, and rule-based portfolio recommendations.

### Database Tables (12 new)
- [x] `portfolio_analytics`, `portfolio_performance`, `portfolio_benchmarks`, `portfolio_attribution`
- [x] `strategy_attribution`, `asset_attribution`, `portfolio_health_scores`
- [x] `portfolio_recommendations`, `allocation_snapshots`, `benchmark_snapshots`
- [x] `performance_periods`, `analytics_audit_log`

### Core Services
- [x] Performance engine (TWR/MWR/Sharpe/Sortino/Calmar/Alpha/Beta/IR/MaxDD)
- [x] Benchmark service, attribution engine, health engine, diversification engine
- [x] Allocation tracker, recommendation engine, analytics scheduler

### API Endpoints (Phase 7)
- [x] 27 endpoints under `/api/v1/portfolio/`

---

## Phase 8 — AI Research Assistant & Quant Intelligence Layer ✅ COMPLETE

**Goal**: Advisory-only AI layer that explains platform data, generates reports, answers questions, and provides analytical insights. AI has NO trading authority.

### Database Tables (10 new)
- [x] `ai_conversations` — persistent conversation sessions
- [x] `ai_queries` — individual Q&A turns within conversations
- [x] `ai_context_snapshots` — frozen data snapshots used for each query
- [x] `ai_reports` — generated analytical reports (stored, reproducible)
- [x] `ai_insights` — structured data-driven insights
- [x] `ai_summaries` — concise domain summaries
- [x] `ai_explanations` — targeted explanations of specific events
- [x] `ai_recommendations` — AI-explained rule-based recommendations
- [x] `ai_usage_metrics` — token/cost tracking per provider per call
- [x] `ai_audit_log` — immutable audit trail for every AI interaction

### LLM Provider Abstraction
- [x] `ILlmProvider` interface — unified contract all providers implement
- [x] `MockLlmProvider` — deterministic responses, no API key required (default)
- [x] `OpenAiLlmProvider` — OpenAI Chat Completions API adapter
- [x] `AnthropicLlmProvider` — Anthropic Messages API adapter
- [x] `GeminiLlmProvider` — Google Gemini generateContent API adapter
- [x] `AiProviderFactory` — env-driven provider selection (AI_PROVIDER env var)
- [x] Provider switching via environment variable — zero application code changes

### AI Context Engine
- [x] `ai-context-builder.ts` — aggregates all platform data domains into context snapshots
- [x] Reads from: portfolio analytics, risk engine, paper trading, research, benchmarks, health, recommendations
- [x] `formatContextAsPrompt()` — converts context to structured LLM-ready prompt text
- [x] Context snapshots stored in DB for auditability and reproducibility

### AI Services
- [x] `ai-types.ts` — shared TypeScript types (providers, context, chat, reports, analysis)
- [x] `ai-db.ts` — unified DB layer for all 10 AI tables
- [x] `ai-provider-factory.ts` — factory with fallback-to-mock on missing API keys
- [x] `ai-chat-service.ts` — conversational Q&A with conversation history and context
- [x] `ai-report-engine.ts` — report generation for 12 report types
- [x] `ai-analysis-service.ts` — strategy, portfolio, risk analysis + comparison + insights

### AI Capabilities (Advisory Only — No Trading Authority)
- [x] Portfolio performance explanation
- [x] Strategy strengths/weaknesses/drawdown/regime analysis
- [x] Risk event explanation (violations, circuit breakers, kill switches, drawdowns)
- [x] Health score interpretation (composite + dimension breakdown)
- [x] Benchmark comparison narrative
- [x] Diversification and concentration analysis
- [x] Comparison engine (strategy vs. strategy, portfolio vs. benchmark, backtest vs. paper, risk profile vs. risk profile)
- [x] Insight generation (structured JSON observations with category and severity)
- [x] Report generation (12 types: portfolio, strategy, risk, performance, benchmark, health, diversification, allocation, daily, weekly, monthly, research)
- [x] Chat assistant with session memory (conversation history threading)

### API Endpoints (Phase 8 — 15 endpoints)
- [x] `POST /v1/ai/chat` — conversational Q&A with full context
- [x] `POST /v1/ai/report` — generate analytical report
- [x] `GET /v1/ai/reports` — list stored reports
- [x] `GET /v1/ai/reports/:id` — get specific report
- [x] `GET /v1/ai/insights` — list insights
- [x] `POST /v1/ai/insights/generate` — trigger insight generation
- [x] `PATCH /v1/ai/insights/:id/acknowledge` — acknowledge insight
- [x] `GET /v1/ai/summaries` — list domain summaries
- [x] `POST /v1/ai/summaries/portfolio` — generate portfolio analysis
- [x] `POST /v1/ai/summaries/strategy` — generate strategy analysis
- [x] `POST /v1/ai/summaries/risk` — generate risk analysis
- [x] `GET /v1/ai/context` — preview context snapshot
- [x] `GET /v1/ai/context/:id` — get stored context snapshot
- [x] `GET /v1/ai/conversations` — list conversation sessions
- [x] `GET /v1/ai/conversations/:id/queries` — get conversation queries
- [x] `GET /v1/ai/usage` — token usage metrics
- [x] `GET /v1/ai/usage/summary` — aggregated usage by provider
- [x] `GET /v1/ai/audit-log` — immutable AI audit log
- [x] `POST /v1/ai/compare` — narrative comparison engine

### Cost Control Architecture
- [x] Per-call token usage recording (ai_usage_metrics)
- [x] Provider-level usage aggregation
- [x] AI_RATE_LIMIT_PER_MINUTE env var (architecture — enforcement in Phase 10)
- [x] AI_MONTHLY_TOKEN_BUDGET env var (architecture — enforcement in Phase 10)

### OpenAPI & Codegen
- [x] `ai` tag added with safety advisory description
- [x] Version bumped to 0.8.0
- [x] 19 path entries added under `/v1/ai/`
- [x] 17 new component schemas
- [x] Codegen regenerated (Zod schemas + React Query hooks)

### Safety Controls
- [x] System prompt enforces advisory-only boundary for all AI interactions
- [x] AI cannot: execute trades, approve/reject orders, override risk controls, bypass circuit breakers
- [x] Immutable audit log records every AI interaction (prompt, response, context, tokens, latency)
- [x] Provider fallback to mock on missing API key (no server crash on misconfiguration)

---

## Phase 9 — Real-Time Market Streaming & Event Infrastructure ✅ COMPLETE

**Goal**: Live data backbone — WebSocket provider abstraction, event bus, market state engine, tick replay, gap recovery, and latency tracking. No broker execution, no real orders.

### Database Tables (12 new)
- [x] `market_ticks` — real-time tick data (price, bid, ask, spread, volume, latency)
- [x] `market_orderbooks` — periodic order book snapshots (depth, imbalance, liquidity)
- [x] `market_trades` — individual exchange trade events (price, qty, side)
- [x] `stream_sessions` — WebSocket session lifecycle records
- [x] `stream_health` — per-provider health snapshots (heartbeat, latency, health score)
- [x] `stream_failures` — connection errors, timeouts, parse errors
- [x] `stream_recovery_events` — gap fill and backfill recovery records
- [x] `market_state_snapshots` — periodic persistence of in-memory market state
- [x] `event_bus_events` — lifecycle event audit log (sampled — ticks not individually stored)
- [x] `event_processing_metrics` — throughput/latency metrics per event type per window
- [x] `latency_metrics` — individual pipeline stage latency measurements
- [x] `stream_audit_log` — immutable record of all stream infrastructure actions

### Provider Abstraction (ADR-021)
- [x] `IStreamProvider` interface — unified contract for all streaming providers
- [x] `MockStreamProvider` — synthetic tick/orderbook/trade data (default, no API key)
- [x] `BinanceWebSocketProvider` — Binance combined stream (ticker + depth + aggTrade)
- [x] `ForexStreamProvider` stub — future forex integration placeholder
- [x] `EquitiesStreamProvider` stub — future equities integration placeholder
- [x] `StreamProviderFactory` — env-driven selection (STREAM_PROVIDER=mock|binance)

### Core Services
- [x] `stream-types.ts` — shared TypeScript types (IStreamProvider, MarketState, ReplayConfig, etc.)
- [x] `stream-db.ts` — unified DB layer for all 12 tables
- [x] `event-bus.ts` — in-memory EventEmitter bus with DB audit persistence (ADR-020)
- [x] `market-state-engine.ts` — Map<symbol, MarketState> + VWAP + momentum + volatility (ADR-022)
- [x] `stream-connection-manager.ts` — WebSocket lifecycle, reconnect backoff, health loop
- [x] `tick-processor.ts` — batched DB persistence (batch size 20, flush every 2s)
- [x] `orderbook-processor.ts` — sampled order book persistence (every 10th update)
- [x] `trade-processor.ts` — exchange trade event persistence
- [x] `stream-metrics-processor.ts` — latency recording + rolling percentile computation
- [x] `replay-engine.ts` — DB-backed tick replay at 1x/5x/10x/100x speed (ADR-023)
- [x] `stream-recovery-service.ts` — gap detection every 15s + OHLCV backfill (ADR-024)
- [x] `stream-health-engine.ts` — composite health score (connection + heartbeat + latency + reliability)
- [x] `stream-scheduler.ts` — master startup entry point (non-fatal — server starts without streaming)

### API Endpoints (Phase 9 — 14 endpoints)
- [x] `GET /v1/streams/status` — live streaming status, provider, symbols, tick counts
- [x] `GET /v1/streams/providers` — available providers with capabilities
- [x] `GET /v1/streams/health` — per-provider health score and latency stats
- [x] `GET /v1/streams/sessions` — session history
- [x] `GET /v1/streams/failures` — failure event log
- [x] `GET /v1/streams/latency` — latency measurements + summary stats
- [x] `GET /v1/streams/metrics` — event processing throughput metrics
- [x] `GET /v1/streams/recovery` — gap fill and recovery events
- [x] `GET /v1/streams/audit` — immutable stream infrastructure audit log
- [x] `GET /v1/ticks` — recent tick data with time range support
- [x] `GET /v1/orderbook` — current order book with live state augmentation
- [x] `GET /v1/market-state` — live in-memory state (fallback to DB snapshot)
- [x] `POST /v1/replay/start` — start tick replay at configurable speed
- [x] `POST /v1/replay/stop` — stop active replay
- [x] `GET /v1/replay/status` — replay session state

### Environment Variables
- [x] `STREAM_ENABLED=true` — enables/disables streaming on startup (default: true)
- [x] `STREAM_PROVIDER=mock` — provider selection: mock | binance (default: mock)
- [x] `STREAM_SYMBOLS=BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT` — symbols to subscribe

### OpenAPI & Codegen
- [x] `streams` tag added
- [x] Version bumped to 0.9.0
- [x] 15 path entries added under Phase 9 routes
- [x] 18 new component schemas
- [x] Codegen regenerated (Zod schemas + React Query hooks)

---

## Phase 10 — Institutional Execution Engine ✅ COMPLETE

**Goal**: Production-quality OMS with pre-trade risk pipeline, order state machine, fill engine, position tracking, and full audit trail. SAFE MODE ONLY — simulation and paper modes; live execution permanently disabled.

### Database (12 tables)
- [x] `execution_accounts` — account with balance and mode
- [x] `execution_orders` — full order lifecycle with all status fields
- [x] `execution_order_events` — immutable per-order event log
- [x] `execution_routes` — routing decisions and latency
- [x] `execution_fills` — fill records with slippage tracking
- [x] `execution_positions` — position P&L with mark-to-market
- [x] `execution_sessions` — OMS session lifecycle
- [x] `execution_rejections` — pre-trade rejection log by stage
- [x] `execution_latency` — per-stage latency measurements
- [x] `execution_metrics` — aggregated quality metrics (fill rate, slippage, p95)
- [x] `execution_recovery` — recovery event tracking
- [x] `execution_audit_log` — immutable audit trail

### Core Services (14 files)
- [x] `execution-types.ts` — IExecutionProvider, ExecutionMode, OrderState, all shared types
- [x] `execution-db.ts` — all DB access helpers
- [x] `execution-state-machine.ts` — order state transition enforcement (ADR-026)
- [x] `execution-pre-trade-pipeline.ts` — validation → risk → circuit-breaker gate (ADR-027)
- [x] `mock-execution-provider.ts` — instant-fill simulation provider
- [x] `paper-execution-provider.ts` — realistic fill pricing via Phase 9 MarketStateEngine
- [x] `execution-router.ts` — mode-aware provider selection with health tracking (ADR-028)
- [x] `execution-oms.ts` — master OMS: full pipeline orchestration + event bus publish
- [x] `execution-fill-engine.ts` — fill processing with slippage calculation (ADR-029)
- [x] `execution-position-engine.ts` — position open/update/close with P&L (ADR-030)
- [x] `execution-monitor.ts` — stale/stuck order detection + MTM refresh (ADR-031)
- [x] `execution-analytics-engine.ts` — quality metrics computation every 5 min (ADR-032)
- [x] `execution-recovery-service.ts` — lost ACK/fill recovery every 60s (ADR-033)
- [x] `execution-scheduler.ts` — master startup; validates EXECUTION_MODE; non-fatal

### API Endpoints (13 endpoints)
- [x] `POST /v1/execution/orders` — submit order (full pre-trade pipeline)
- [x] `GET /v1/execution/orders` — list orders with filters
- [x] `GET /v1/execution/orders/:id` — order detail + event history
- [x] `POST /v1/execution/orders/:id/cancel` — cancel active order
- [x] `GET /v1/execution/fills` — fill history with symbol/time filters
- [x] `GET /v1/execution/positions` — positions with P&L summary
- [x] `GET /v1/execution/rejections` — rejection log by stage
- [x] `GET /v1/execution/health` — OMS health (active orders, providers, session)
- [x] `GET /v1/execution/providers` — provider list with health metrics
- [x] `GET /v1/execution/sessions` — session history
- [x] `GET /v1/execution/metrics` — fill rate, slippage, latency percentiles
- [x] `GET /v1/execution/latency` — per-stage latency summary
- [x] `GET /v1/execution/audit-log` — immutable order action trail

### Environment Variables
- [x] `EXECUTION_MODE=simulation` — execution mode: simulation | paper | live_disabled (default: simulation)
- [x] `EXECUTION_ENABLED=true` — enables/disables OMS on startup (default: true)

### OpenAPI & Codegen
- [x] `execution` tag added
- [x] Version bumped to 0.10.0
- [x] 13 path entries added under Phase 10 routes
- [x] 15 new component schemas
- [x] Codegen regenerated (Zod schemas + React Query hooks)

### Safety Guarantees
- [x] EXECUTION_MODE=live is not accepted — scheduler refuses to start
- [x] No real-money API credentials in codebase
- [x] All orders route to mock or paper provider only
- [x] Kill-switch integration via Phase 6 circuit breaker check in pre-trade pipeline

---

## Phase 11 — Multi-Agent Intelligence & Autonomous Strategy Factory ✅ COMPLETE

### DB Schema (11 tables)
- [x] `strategy_rankings` — multi-period strategy rankings with composite scores
- [x] `market_regimes` — regime classifications with confidence scores and history
- [x] `portfolio_allocations` — allocation snapshots with weight maps
- [x] `allocation_history` — per-strategy weight change audit trail
- [x] `strategy_clusters` — parameter/performance space cluster assignments
- [x] `strategy_correlations` — pairwise strategy correlation matrix
- [x] `optimization_runs` — optimizer run metadata (method, objective, status, best score)
- [x] `optimization_results` — per-iteration trial results with parameter snapshots
- [x] `strategy_generations` — genetic algorithm generation history
- [x] `ai_agent_tasks` — AI task orchestration queue
- [x] `research_sessions` — research session audit log

### Services
- [x] `intelligence-db.ts` — persistence layer for all Phase 11 entities
- [x] `intelligence-types.ts` — shared TypeScript types for all Phase 11 subsystems
- [x] `ranking-engine.ts` — multi-factor ranking (Sharpe/Sortino/Calmar/drawdown/win rate/WF/MC)
- [x] `regime-detection-engine.ts` — 6-indicator ensemble regime classifier
- [x] `portfolio-allocator.ts` — 4 allocation methods (equal/risk_parity/mean_variance/momentum)
- [x] `genetic-evolution-engine.ts` — genetic algorithm with tournament selection + elitism
- [x] `strategy-optimizer.ts` — 4 optimization methods (grid/random/bayesian/genetic)
- [x] `ai-optimization-assistant.ts` — LLM-powered strategy analysis and suggestions
- [x] `continuous-learning-engine.ts` — regime-aware performance monitoring and re-optimization
- [x] `intelligence-correlation-engine.ts` — strategy clustering by parameter/performance space
- [x] `research-coordinator.ts` — multi-step research session orchestrator
- [x] `intelligence-scheduler.ts` — 5-loop background scheduler (regime/ranking/clustering/coordination/learning)

### API Routes
- [x] 17 endpoints under `/api/v1/intelligence/*`
- [x] Rankings (CRUD + trigger), regimes (CRUD + trigger), allocations (CRUD + trigger)
- [x] Optimization runs/results (CRUD + trigger), strategy generations (read)
- [x] AI agent tasks (CRUD + trigger), research sessions (CRUD + trigger)

### OpenAPI & Codegen
- [x] Version bumped to 0.11.0
- [x] Intelligence paths and schemas added
- [x] Codegen regenerated (Zod schemas + React Query hooks)

### Safety Guarantees
- [x] Advisory-only — no live capital, no order placement
- [x] All optimization uses the Phase 4 backtest engine (fill-at-open N+1)
- [x] No real-money API credentials in codebase

---

## Phase 12 — Observability, Monitoring & Operations Platform ✅ COMPLETE

**Goal**: Full platform visibility across all 11 prior phases via real metrics collection, per-service health engines, alert rules/events, incident management, and operations dashboard APIs.

### DB Schemas (15 new tables)
- [x] `system_metrics` — CPU/memory/heap/event-loop/DB latency, collected every 30s
- [x] `service_health` — per-service status/score/consecutive-failure tracker
- [x] `scheduler_health` — per-loop run/miss/fail counters for every background scheduler
- [x] `api_metrics` — per-endpoint request counts, latency, error rate (Phase 12 schema)
- [x] `strategy_health` — Sharpe/drawdown/win-rate health for every registered strategy
- [x] `execution_health` — fill rate, latency p95, slippage, rejection rate by time window
- [x] `stream_health_history` — stream provider latency, ticks/s, reconnects, last-tick age
- [x] `ai_health` — AI provider availability, token usage, avg/p95 latency by window
- [x] `alert_rules` — 12 built-in rules across system/data/scheduler/strategy/execution categories
- [x] `alert_events` — fired alert instances with status lifecycle (active → acknowledged → resolved)
- [x] `incidents` — incident records with severity, affected services, root cause, resolution
- [x] `incident_timeline` — append-only event log per incident (opened/update/investigating/resolved)
- [x] `uptime_history` — per-service up/down/degraded/maintenance duration tracking
- [x] `performance_snapshots` — 15-min platform score (0–100) with per-component breakdown
- [x] `monitoring_audit_log` — all acknowledge/resolve/config actions with actor tracking

### Core Services (8 services)
- [x] `metrics-collector.ts` — live system metrics via `process.memoryUsage()`, event-loop lag, DB probe
- [x] `service-health-engine.ts` — evaluates 8 platform services (ingestion, paper, risk, analytics, AI, stream, execution, intelligence), writes health score 0–100
- [x] `scheduler-monitor.ts` — snapshots all Phase 1–11 background loops, detects missed/failed runs
- [x] `strategy-health-engine.ts` — reads backtest + paper performance; computes Sharpe/drawdown/win-rate health per strategy
- [x] `ai-health-engine.ts` — aggregates AI usage metrics by provider/window; computes availability + failure rates
- [x] `execution-health-engine.ts` — aggregates execution latency, fill/rejection rates, slippage by time window
- [x] `alert-engine.ts` — evaluates 12 built-in alert rules, fires alert events, respects cooldowns, seeds rules on startup
- [x] `incident-manager.ts` — auto-opens incidents from emergency alerts, lifecycle transitions, timeline appends

### Ops Scheduler (10 background loops)
- [x] `ops-scheduler.ts` — 30s system metrics, 2m service health, 60s alert eval, 60s scheduler snapshot, 2m stream snapshot, 5m strategy health, 15m AI/execution health, 5m incident scan, 15m performance snapshot

### API Routes (13 route files, 29 endpoints)
- [x] `ops-overview-route.ts` — `GET /api/v1/ops/overview` — platform health summary
- [x] `ops-services-route.ts` — `GET /api/v1/ops/services`, `GET /api/v1/ops/services/:service/history`
- [x] `ops-schedulers-route.ts` — `GET /api/v1/ops/schedulers`, `GET /api/v1/ops/schedulers/live`
- [x] `ops-alerts-route.ts` — list/acknowledge/resolve alert events
- [x] `ops-alert-rules-route.ts` — list + enable/disable alert rules
- [x] `ops-incidents-route.ts` — list/get/investigate/resolve incidents + add timeline updates
- [x] `ops-uptime-route.ts` — `GET /api/v1/ops/uptime`
- [x] `ops-performance-route.ts` — `GET /api/v1/ops/performance`, `GET /api/v1/ops/performance/latest`
- [x] `ops-system-metrics-route.ts` — list + latest + live system metrics (3 endpoints)
- [x] `ops-ai-health-route.ts` — `GET /api/v1/ops/ai-health`, `POST /api/v1/ops/ai-health/refresh`
- [x] `ops-execution-health-route.ts` — `GET /api/v1/ops/execution-health`, `POST /api/v1/ops/execution-health/refresh`
- [x] `ops-stream-health-route.ts` — `GET /api/v1/ops/stream-health`
- [x] `ops-strategy-health-route.ts` — `GET /api/v1/ops/strategy-health`, `POST /api/v1/ops/strategy-health/refresh`
- [x] `ops-audit-log-route.ts` — `GET /api/v1/ops/audit-log`

### OpenAPI & Codegen
- [x] Version bumped to 0.12.0
- [x] `operations` tag added; 29 Phase 12 paths added; 15 Phase 12 schemas added
- [x] Codegen regenerated (Zod schemas + React Query hooks)

### Verified Endpoints
- [x] `GET /api/v1/ops/overview` — returns live platform score, 8 services, active alert count
- [x] `GET /api/v1/ops/alert-rules` — returns 12 seeded alert rules
- [x] `GET /api/v1/ops/system-metrics/live` — returns in-memory CPU/memory/heap snapshot

---

## Phase 13 — Frontend Operations & Intelligence Dashboard ✅ COMPLETE

### Scaffold
- [x] `artifacts/dashboard/` — React + Vite + Tailwind v4 + shadcn + recharts workspace package
- [x] `pnpm-workspace.yaml` updated to include `artifacts/dashboard`
- [x] Dashboard workflow configured on port 5000

### Pages (11 total)
- [x] `/` — Command Center (platform KPIs, system metrics, service health grid, recent alerts)
- [x] `/operations` — Operations Dashboard (platform score gauge, scheduler health table, performance chart)
- [x] `/service-health` — Service Health drill-down with per-service history table
- [x] `/alerts` — Alert Events (filterable by status, ack/resolve actions) + Alert Rules (enable/disable)
- [x] `/incidents` — Incident list, timeline view, investigate/resolve, update notes form
- [x] `/portfolio` — Portfolio analytics, health grade, drawdown KPIs, recommendations table
- [x] `/strategy-rankings` — Multi-period leaderboard (`daily/weekly/monthly/all_time`), regime panel, clusters
- [x] `/risk` — Kill switch status, circuit breakers, violations, drawdown events
- [x] `/execution` — Fill rate, latency KPIs, active positions table, recent orders table
- [x] `/streaming` — Stream provider status, BTCUSDT market state, session table
- [x] `/ai-insights` — Insights feed with ack, summary generation buttons, AI health provider badges

### Shared UI Components
- [x] `DataTable<T>` — generic typed table with `cell?: (item: T, index: number) => ReactNode`
- [x] `KpiCard` — dark-theme KPI tile with optional trend indicator
- [x] `PageHeader` — title/subtitle/children slot for controls
- [x] `Badge` — 14-variant semantic badge (healthy/warning/failed/critical/emergency/info/…)
- [x] `HealthBar` — segmented health score bar (0–100)
- [x] `Sidebar` — collapsible navigation with all 11 routes
- [x] `ThemeProvider` — dark/light toggle

### Verification
- [x] TypeScript strict mode passes clean (`tsc --noEmit`) — zero errors
- [x] Dashboard renders live data from API server (platform score, active alerts, incidents visible)
- [x] All 11 pages import exclusively from `@workspace/api-client-react` (no mock data)

---

## Phase 14 — Authentication, RBAC, Multi-Tenant SaaS & Security Foundation ✅ COMPLETE

### Database (16 new tables)
- [x] `users` — email/password accounts, super-admin flag, email verification, lockout tracking
- [x] `sessions` — JWT-backed sessions with IP/UA binding and sliding expiry
- [x] `refresh_tokens` — refresh token rotation; one-time-use, revocable
- [x] `organizations` — multi-tenant orgs (slug, plan, seat limit)
- [x] `org_teams` — sub-groups within an organization
- [x] `org_memberships` — user ↔ org M:N with `orgRole` (owner/admin/member)
- [x] `org_invitations` — token-based invitations with expiry and status
- [x] `roles` — named system-level roles (super_admin, admin, analyst, etc.)
- [x] `permissions` — fine-grained permission strings (`resource:action`)
- [x] `role_permissions` — M:N roles ↔ permissions
- [x] `user_roles` — M:N users ↔ roles (optional org scope)
- [x] `security_events` — immutable security event log (login, lockout, brute-force, etc.)
- [x] `audit_events` — admin action audit trail with before/after snapshots
- [x] `user_preferences` — per-user UI/notification preferences
- [x] `user_settings` — per-user security settings (2FA, session timeout, IP allowlist)
- [x] `api_keys` — hashed API keys for programmatic access with permission scope

### Services (13 files)
- [x] `auth-types.ts` — all Phase 14 TypeScript interfaces and enums
- [x] `auth-db.ts` — raw DB queries (create/find/update) for all 16 tables
- [x] `password-service.ts` — argon2 hash/verify with timing-safe comparison
- [x] `token-service.ts` — JWT access/refresh generation and verification
- [x] `session-service.ts` — session create/revoke/list with sliding window
- [x] `auth-service.ts` — register, login, logout, ensureSuperAdminExists
- [x] `rbac-service.ts` — seedRolesAndPermissions, getUserEffectivePermissions
- [x] `tenant-service.ts` — org create/update/get, team CRUD, membership ops
- [x] `invitation-service.ts` — send/accept/decline/expire invitations
- [x] `api-key-service.ts` — generate (prefix+hash), validate, revoke API keys
- [x] `email-provider.ts` — IEmailProvider interface + ConsoleEmailProvider + SmtpEmailProvider
- [x] `security-event-service.ts` — recordSecurityEvent helper
- [x] `auth-audit-service.ts` — auditLog helper for admin actions

### Middleware (5 files)
- [x] `auth-middleware.ts` — resolveAuth (populates req.auth), requireAuth guard
- [x] `rbac-middleware.ts` — requirePermission, requireRole, requireSelfOrAdmin
- [x] `tenant-middleware.ts` — resolveTenant from X-Organization-Id header
- [x] `rate-limit-middleware.ts` — three tiers: general (200/15m), auth (20/15m), strict (5/15m)
- [x] `security-headers-middleware.ts` — HSTS, CSP, X-Frame-Options, CORP headers

### Routes (17 files, 50+ endpoints)
- [x] `auth-register` — `POST /v1/auth/register`
- [x] `auth-login` — `POST /v1/auth/login`, `POST /v1/auth/logout`
- [x] `auth-refresh` — `POST /v1/auth/refresh`
- [x] `auth-me` — `GET /v1/auth/me`, `PATCH /v1/auth/me`
- [x] `auth-password` — `POST /v1/auth/password/forgot`, `/reset`, `/change`
- [x] `auth-verify` — `POST /v1/auth/verify-email`, `/resend`
- [x] `auth-sessions` — `GET/DELETE /v1/auth/sessions`, `DELETE /v1/auth/sessions/:id`
- [x] `users-admin` — `GET /v1/users`, `GET/PATCH /v1/users/:id`, `POST /v1/users/:id/deactivate`
- [x] `organizations-route` — `POST/GET /v1/organizations`, `GET/PATCH /v1/organizations/:id`
- [x] `teams-route` — `GET/POST /v1/organizations/:id/teams`, `GET/PATCH /v1/teams/:id`
- [x] `memberships-route` — `GET/PATCH/DELETE /v1/organizations/:id/members/:uid`
- [x] `invitations-route` — send/list/lookup/accept/decline invitation endpoints
- [x] `rbac-roles` — roles CRUD, assign/remove user roles
- [x] `rbac-permissions` — permissions list, effective permissions per user
- [x] `security-events-route` — security event log with filtering
- [x] `audit-events-route` — audit trail with filtering
- [x] `api-keys-route` — create/list/revoke API keys

### Frontend (10 pages + auth context)
- [x] `AuthProvider` / `useAuth` — token storage, auto-refresh, role/permission state
- [x] `auth-client.ts` — typed fetch wrapper with JWT auto-refresh on 401
- [x] `/login` — email/password sign-in with remember-me
- [x] `/register` — account creation with optional org creation
- [x] `/forgot-password` — email-based password reset request
- [x] `/reset-password` — token-based password reset (linked from email)
- [x] `/verify-email` — email verification + resend
- [x] `/accept-invitation` — token-based org invitation acceptance
- [x] `/profile` — account info, password change, active sessions, permissions
- [x] `/security` — security event log + audit trail (admin-only)
- [x] `/users` — user management table + system roles overview
- [x] `/org-settings` — org info, member list, send invitations
- [x] Sidebar updated — Admin section (Security/Users/Organization) gated by permission
- [x] Protected/auth route wrappers — redirect unauthenticated users to `/login`

### Infra
- [x] App.tsx — AuthProvider wrapper, protected/auth route components
- [x] `app.ts` — security headers, general rate limit, resolveAuth, resolveTenant on all /api routes
- [x] `index.ts` — seedRolesAndPermissions + ensureSuperAdminExists on startup
- [x] `routes/v1/index.ts` — all 17 Phase 14 routers mounted

---

## Phase 15 — Billing, Subscriptions & SaaS Commercialization ✅ COMPLETE

See CHANGELOG.md [0.15.0] for full details.

---

## Phase 16 — Production Readiness & Hardening ✅ COMPLETE

> Last updated: 2026-06-04

### T001 — Security Hardening Audit ✅
- [x] `security-audit-service.ts` — 19-control runtime security posture checker (auth, RBAC, headers, rate limiting, secrets, execution safety, dependencies)
- [x] `ops-security-audit-route.ts` — `GET /ops/security-audit` (5-min cache), `POST /ops/security-audit/refresh`
- [x] `security-audit-report.md` — manual audit report: 88/100 score, 0 critical/high findings, 3 medium config-level warnings

### T002 — Backup & Recovery System ✅
- [x] DB tables: `backup_jobs`, `backup_runs`, `restore_tests`, `backup_audit_log`
- [x] `backup-service.ts` — metadata backup execution (row counts, checksums via pg_stat_user_tables)
- [x] `restore-service.ts` — checksum, row-count variance, schema presence, full restore test modes
- [x] `backup-scheduler.ts` — 5-min polling loop (runs due jobs) + 6-hr restore test loop + default job seeding on startup
- [x] `ops-backups-route.ts` — backup job CRUD, manual trigger, run history
- [x] `ops-recovery-route.ts` — restore test history, on-demand restore test execution

### T003 — Alert Delivery Layer ✅
- [x] DB tables: `notification_channels`, `notification_deliveries`
- [x] `webhook-provider.ts` — generic HTTP webhook + Slack Block Kit delivery
- [x] `notification-engine.ts` — multi-channel fan-out with retry, cooldown, severity filter
- [x] `ops-notifications-route.ts` — channel CRUD, delivery history, 24h stats

### T004 — Health Check Framework ✅
- [x] `/health/live` — pure liveness probe (no external deps, instant)
- [x] `/health/ready` — readiness probe (DB ping + event loop lag + memory pressure)
- [x] `/health/dependencies` — full per-component inventory (database, AI, streaming, execution, billing, memory, event loop)
- [x] Legacy `/healthz` preserved unchanged

### T005 — Performance Profiling ✅
- [x] `performance-profiler.ts` — in-memory rolling 5-min window, p50/p95/p99, 24h snapshot history
- [x] `ops-profiling-route.ts` — current snapshot, per-endpoint latency, metrics history, manual snapshot trigger

### T006 — Load Testing Suite ✅
- [x] `tests/load/api-load-test.ts` — VU-based concurrent runner: smoke/load/stress/spike profiles, weighted scenarios, p50/p95/p99 with threshold evaluation
- [x] `tests/load/benchmark-report.md` — baseline latency targets, SLA thresholds, bottleneck analysis, monitoring guidance

### T007+T008 — Deployment & Disaster Recovery Docs ✅
- [x] `DEPLOYMENT.md` — pre-deploy checklist, startup sequence, env var reference, Replit deployment guide, rollback procedure
- [x] `RUNBOOK.md` — 10-section operations runbook: server failure, DB outage, API outage, streaming failure, scheduler failure, high memory/CPU, security incident, backup/restore, disaster recovery, alert matrix

### T009 — CI/CD Hardening ✅
- [x] `.github/workflows/ci.yml` — 5 jobs: typecheck (blocking), build (blocking), OpenAPI validation (blocking), security audit (non-blocking), lint (non-blocking)
- [x] `.github/workflows/release.yml` — pre-release validation + GitHub release creation on tag push

### T010 — Production Dashboard Enhancements ✅
- [x] `artifacts/dashboard/src/pages/production-status.tsx` — 5 tabs: Overview, Security Checks, Backup & Recovery, Performance, Notifications
- [x] `App.tsx` — `/production-status` route wired with `ProtectedRoute`
- [x] `sidebar.tsx` — "Production Status" nav link added to admin section (`Gauge` icon)

### T011 — Documentation Updates ✅
- [x] `CHANGELOG.md` — v0.16.0 entry with full added/changed inventory
- [x] `DECISIONS.md` — ADR-034 through ADR-038 (backup strategy, notification engine, health probes, profiling, CI/CD)
- [x] `TODO.md` — this file updated
- [x] `AGENTS.md` — phase awareness updated to Phase 16
- [x] `replit.md` — Phase 16 endpoints and architecture decisions documented
