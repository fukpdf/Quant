# TODO.md — QuantForge Phased Roadmap

> Last updated: 2026-06-01
> Current phase: **Phase 8 — AI Research Assistant & Quant Intelligence Layer** ✅ COMPLETE

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

## Phase 10 — Production Readiness

- [ ] Full security audit
- [ ] Penetration testing checklist
- [ ] Comprehensive health monitoring
- [ ] AI rate limiting enforcement (AI_RATE_LIMIT_PER_MINUTE)
- [ ] AI monthly token budget enforcement (AI_MONTHLY_TOKEN_BUDGET)
- [ ] Alerting infrastructure (webhook + email)
- [ ] Database backup automation
- [ ] Performance profiling and optimization
- [ ] Deployment pipeline (CI/CD)
- [ ] Documentation site generation
