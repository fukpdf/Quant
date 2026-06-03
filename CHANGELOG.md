# CHANGELOG.md — QuantForge

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Nothing yet

### Changed
- Nothing yet

### Fixed
- Nothing yet

### Removed
- Nothing yet

---

## [0.10.0] — 2026-06-03

### Phase 10 — Institutional Execution Engine (SAFE MODE ONLY)

#### Added
- **12 new database tables**: `execution_accounts`, `execution_orders`, `execution_order_events`, `execution_routes`, `execution_fills`, `execution_positions`, `execution_sessions`, `execution_rejections`, `execution_latency`, `execution_metrics`, `execution_recovery`, `execution_audit_log`
- **execution-types.ts** — `IExecutionProvider` interface, `ExecutionMode` enum (`simulation | paper | live_disabled`), `OrderStatus` state set, `ACTIVE_ORDER_STATUSES`, `TERMINAL_ORDER_STATUSES`, `VALID_EXECUTION_MODES`, and all shared DTOs
- **execution-state-machine.ts** (ADR-026) — strict state transition enforcement; illegal transitions throw immediately; every transition recorded to `execution_order_events`
- **execution-pre-trade-pipeline.ts** (ADR-027) — four-stage pre-trade gate: schema validation → risk snapshot check (Phase 6 engine) → kill-switch check → circuit-breaker check; rejects with stage tag recorded to `execution_rejections`
- **MockExecutionProvider** — instant-fill simulation; fills at last known market price ± 0–5 bps random slippage; no API key required; default for `EXECUTION_MODE=simulation`
- **PaperExecutionProvider** — realistic fills using Phase 9 `MarketStateEngine`; mid-price ± half-spread with order-type appropriate slippage; uses VWAP for large orders
- **execution-router.ts** (ADR-028) — mode-aware provider selection; health-checks providers on boot; returns `live_disabled` provider stub if mode is `live_disabled`; tracks per-provider latency
- **execution-oms.ts** — master OMS orchestrator; `submitOrder()` runs full pipeline in one call: pre-trade → route → provider.submit → fill engine → position engine → audit log → event bus publish
- **execution-fill-engine.ts** (ADR-029) — fill processing with commission (0.1% maker/taker), slippage in bps, and `ExecutionFill` DB write; publishes `FillReceived` event
- **execution-position-engine.ts** (ADR-030) — position open/update/close with average-cost basis, unrealized/realized P&L, mark-to-market updates; publishes `PositionUpdated` event
- **execution-monitor.ts** (ADR-031) — stale order detection (5min threshold), stuck order auto-fail (30min threshold), MTM refresh every 60s
- **execution-analytics-engine.ts** (ADR-032) — computes fill rate, reject rate, cancel rate, avg/p50/p95/p99 latency, avg slippage across `1h / 4h / 1d / 7d` windows every 5 minutes
- **execution-recovery-service.ts** (ADR-033) — lost ACK detection (30s), lost fill detection (5min), recovery timeout handler (10min); automated cancel-on-timeout in simulation mode
- **execution-scheduler.ts** — master startup; validates `EXECUTION_MODE`; refuses to start on invalid mode; upserts default account; creates session record; starts monitor + analytics + recovery
- **13 new REST endpoints** under `execution` tag:
  - `POST /v1/execution/orders` — full-pipeline order submission
  - `GET /v1/execution/orders` — list with status/symbol/mode filters
  - `GET /v1/execution/orders/:id` — detail + full event history
  - `POST /v1/execution/orders/:id/cancel` — cancel active order
  - `GET /v1/execution/fills` — fill history
  - `GET /v1/execution/positions` — positions with P&L summary
  - `GET /v1/execution/rejections` — rejection log with stage breakdown
  - `GET /v1/execution/health` — OMS health (active orders, providers, session)
  - `GET /v1/execution/providers` — provider list with health metrics
  - `GET /v1/execution/sessions` — session history
  - `GET /v1/execution/metrics` — quality metrics (fill rate, slippage, latency p50/p95/p99)
  - `GET /v1/execution/latency` — per-stage latency summary
  - `GET /v1/execution/audit-log` — immutable order action trail
- **11 new EventBus event types**: `OrderCreated`, `OrderRouted`, `OrderAcknowledged`, `OrderFilled`, `OrderPartiallyFilled`, `OrderCancelled`, `OrderFailed`, `OrderRejected`, `FillReceived`, `PositionUpdated`, `ExecutionRecovered`
- **OpenAPI spec v0.10.0** — 13 new paths, 15 new component schemas, `execution` tag

#### Safety Guarantees
- `EXECUTION_MODE=live` is not a valid value — scheduler refuses to start (throws)
- `live_disabled` mode starts the OMS but blocks all orders at provider level
- No real-money API keys in codebase or environment templates
- Kill-switch state (`getKillSwitchStatus()`) checked synchronously in pre-trade pipeline

---

## [0.9.0] — 2026-06-01

### Phase 9 — Real-Time Market Streaming & Event Infrastructure

#### Added
- **12 new database tables**: `market_ticks`, `market_orderbooks`, `market_trades`, `stream_sessions`, `stream_health`, `stream_failures`, `stream_recovery_events`, `market_state_snapshots`, `event_bus_events`, `event_processing_metrics`, `latency_metrics`, `stream_audit_log`
- **IStreamProvider abstraction** (ADR-021) — pluggable provider interface with env-driven selection (`STREAM_PROVIDER=mock|binance`)
- **MockStreamProvider** — synthetic tick/orderbook/trade generation at 1 tick/sec per symbol; no API key required; default provider
- **BinanceWebSocketProvider** — Binance combined stream (miniTicker + depth + aggTrade); lazy `ws` import so server starts without the package
- **ForexStreamProvider** and **EquitiesStreamProvider** stubs for future phases
- **StreamProviderFactory** — singleton provider selection matching AiProviderFactory pattern
- **EventBus** (ADR-020) — in-memory EventEmitter bus with 14 typed event types; lifecycle events persisted to DB; tick events handled at processor level to avoid DB saturation
- **MarketStateEngine** (ADR-022) — `Map<symbol, MarketState>` with rolling VWAP, EMA momentum, volatility (std dev of returns), order book imbalance; snapshots to DB every 30s
- **StreamConnectionManager** — WebSocket lifecycle management with exponential backoff reconnect (1s–60s, max 10 attempts), health snapshot loop every 10s
- **TickProcessor** — batched DB writes (batch 20, flush every 2s) to reduce DB load at high tick rates
- **OrderBookProcessor** — sampled persistence (every 10th update) to reduce volume
- **TradeProcessor** — individual exchange trade event persistence
- **StreamMetricsProcessor** — per-stage latency recording (provider/processing/storage/end-to-end) with rolling p50/p95/p99; window metrics flushed to DB every 60s
- **ReplayEngine** (ADR-023) — DB-backed tick replay at 1x/5x/10x/100x speed; fires TickReceived events through event bus; max one concurrent replay
- **StreamRecoveryService** (ADR-024) — gap detection every 15s (threshold: 10s without tick); OHLCV backfill via existing Binance client; records recovery events
- **StreamHealthEngine** — composite health score 0–100 from connection status (40pts) + heartbeat freshness (30pts) + latency (20pts) + reliability (10pts)
- **StreamScheduler** — master startup entry point; non-fatal (server starts even if streaming fails)
- **15 new REST endpoints** under streams tag:
  - `GET /v1/streams/status` — live streaming status
  - `GET /v1/streams/providers` — provider capabilities
  - `GET /v1/streams/health` — health score per provider
  - `GET /v1/streams/sessions` — session history
  - `GET /v1/streams/failures` — failure event log
  - `GET /v1/streams/latency` — latency measurements + summary stats
  - `GET /v1/streams/metrics` — event processing throughput metrics
  - `GET /v1/streams/recovery` — gap fill recovery events
  - `GET /v1/streams/audit` — immutable stream audit log
  - `GET /v1/ticks` — tick data with time range support
  - `GET /v1/orderbook` — live order book augmented with market state
  - `GET /v1/market-state` — in-memory state (fallback to DB snapshot)
  - `POST /v1/replay/start` — start tick replay
  - `POST /v1/replay/stop` — stop replay
  - `GET /v1/replay/status` — replay session state
- **3 new environment variables**: `STREAM_ENABLED`, `STREAM_PROVIDER`, `STREAM_SYMBOLS`
- **OpenAPI spec v0.9.0** — `streams` tag, 15 path entries, 18 new component schemas
- **ADR-020 through ADR-024** documented in DECISIONS.md

#### Changed
- `index.ts` — `startStreamScheduler()` called on startup (non-fatal try/catch)
- OpenAPI version bumped from 0.8.0 to 0.9.0

---

## [0.8.0] — 2026-06-01

### Phase 8 — AI Research Assistant & Quant Intelligence Layer

#### Added
- **10 new database tables**: `ai_conversations`, `ai_queries`, `ai_context_snapshots`, `ai_reports`, `ai_insights`, `ai_summaries`, `ai_explanations`, `ai_recommendations`, `ai_usage_metrics`, `ai_audit_log`
- **LLM Provider Abstraction** (`ai-types.ts`, `ai-provider-factory.ts`): Env-driven provider selection via `AI_PROVIDER`; supports `openai`, `anthropic`, `gemini`, `mock`; fallback to mock on missing API key prevents crashes on misconfiguration
- **MockLlmProvider**: Deterministic structured responses; no API key required; default provider
- **OpenAiLlmProvider**: Chat Completions API adapter (gpt-4o)
- **AnthropicLlmProvider**: Messages API adapter (claude-opus-4-5)
- **GeminiLlmProvider**: generateContent API adapter (gemini-2.5-pro)
- **AI Context Engine** (`ai-context-builder.ts`): Aggregates all platform data domains (portfolio analytics, risk engine, paper trading, research, benchmarks, health, recommendations) into structured LLM-ready context snapshots; snapshots stored in DB for auditability
- **AI Database Layer** (`ai-db.ts`): Unified DB helper for all 10 AI tables with full CRUD
- **Chat Service** (`ai-chat-service.ts`): Conversational Q&A with conversation threading, session history injection, context domain selection
- **Report Engine** (`ai-report-engine.ts`): 12 report types (portfolio, strategy, risk, performance, benchmark, health, diversification, allocation, daily, weekly, monthly, research); stored and reproducible
- **Analysis Service** (`ai-analysis-service.ts`): Strategy analysis, portfolio analysis, risk analysis, comparison engine (strategy vs. strategy, portfolio vs. benchmark, backtest vs. paper, risk profile comparison), structured insight generation
- **19 new API endpoints** under `/v1/ai/`: chat, report generation, report listing, insight generation/acknowledgement, domain summaries, context preview, conversation listing, token usage metrics, audit log, comparison engine
- **AI audit log**: Every AI interaction (chat, report, insight, analysis) logged with prompt summary, response summary, context domains, provider, model, token counts, latency, and result status
- **Cost control env vars**: `AI_RATE_LIMIT_PER_MINUTE`, `AI_MONTHLY_TOKEN_BUDGET` (architecture defined; enforcement in Phase 10)
- `.env.example` updated with all Phase 8 AI variables and documentation
- Provider logged at startup via pino structured log

#### Changed
- `lib/api-spec/openapi.yaml` bumped to `0.8.0`
- `artifacts/api-server/src/routes/v1/index.ts` extended with 8 Phase 8 AI router mounts
- `artifacts/api-server/src/index.ts` extended with Phase 8 AI provider startup initialization
- `lib/db/src/schema/index.ts` extended with all 10 Phase 8 AI table exports
- OpenAPI description updated to mention AI research assistant
- `ai` tag added to OpenAPI spec with advisory-only safety note

#### Safety Invariants
- AI is advisory-only: cannot execute trades, approve/reject orders, or override risk controls
- System prompt enforces this boundary in all LLM calls
- Immutable audit log records all AI interactions
- Mock provider default ensures platform starts safely without any API key

---

## [0.7.0] — 2026-06-01

### Phase 7 — Portfolio Intelligence & Analytics Platform

#### Added
- **12 new database tables**: `portfolio_analytics`, `portfolio_performance`, `portfolio_benchmarks`, `portfolio_attribution`, `strategy_attribution`, `asset_attribution`, `portfolio_health_scores`, `portfolio_recommendations`, `allocation_snapshots`, `benchmark_snapshots`, `performance_periods`, `analytics_audit_log`
- **Performance Engine** (`performance-engine.ts`): Time-Weighted Return (TWR), Money-Weighted Return (MWR/IRR), Sharpe/Sortino/Calmar ratios, Alpha, Beta, Information Ratio, Max Drawdown
- **Benchmark Service** (`benchmark-service.ts`): BTC, ETH, SOL default benchmarks with seeding; benchmark snapshot refresh
- **Attribution Engine** (`attribution-engine.ts`): Attribution by strategy and asset; Brinson-Hood-Beebower style allocation/selection effects
- **Health Engine** (`health-engine.ts`): Composite health score (0–100) across 5 dimensions: diversification, performance, risk, activity, drawdown
- **Diversification Engine** (`diversification-engine.ts`): Herfindahl-Hirschman Index (HHI), asset concentration, strategy concentration, correlation-adjusted score
- **Allocation Tracker** (`allocation-tracker.ts`): Hourly allocation snapshots; allocation drift detection vs. target weights
- **Recommendation Engine** (`recommendation-engine.ts`): Rule-based recommendations (rebalance, reduce concentration, improve diversification, drawdown alerts, idle capital)
- **Analytics Scheduler** (`analytics-scheduler.ts`): 6 background loops (performance daily, health hourly, attribution daily, allocation 15m, benchmarks 6h, audit log cleanup)
- **10 new route files**: `portfolio-analytics`, `portfolio-performance`, `portfolio-health`, `portfolio-attribution`, `portfolio-benchmarks`, `portfolio-diversification`, `portfolio-allocation`, `portfolio-recommendations`, `portfolio-rankings`, `portfolio-audit`
- **27 new API endpoints** across all portfolio analytics domains
- Startup seeding for default benchmarks; analytics scheduler auto-starts on server boot
- `analytics_audit_log` records all analytics events for auditability
- `analytics-db.ts`: unified DB helper for all analytics read/write operations
- `types-analytics.ts`: shared TypeScript types across all Phase 7 services

#### Changed
- `lib/api-spec/openapi.yaml` bumped to `0.7.0`
- `artifacts/api-server/src/routes/v1/index.ts` extended with 10 Phase 7 router mounts
- `artifacts/api-server/src/index.ts` extended with Phase 7 startup hooks

---

## [0.6.0] — 2026-06-01

### Phase 6 — Institutional Risk Engine & Capital Protection Layer

#### Added
- **12 new DB tables**: `risk_profiles`, `risk_rules`, `risk_decisions`, `risk_events`, `risk_violations`, `portfolio_risk_snapshots`, `strategy_risk_scores`, `correlation_matrices`, `drawdown_events`, `circuit_breaker_events`, `kill_switch_events`, `risk_audit_log`
- **Risk Profile System**: 4 seeded default profiles (Conservative/Balanced/Aggressive/Research) with configurable limits per profile; custom profiles via API; `isDefault` flag for profile resolution
- **Pre-Trade Risk Engine** (`risk-engine.ts`): 13-check sequential gatekeeper; returns `{decision, riskScore, triggeredRules, reason}`; every decision stored in `risk_decisions`; violations stored in `risk_violations`
- **Kill Switch Service** (`kill-switch-service.ts`): in-memory state with 5 scopes (trading/account/strategy/portfolio/scheduler); activate/resume operations; full audit trail in `kill_switch_events`
- **Circuit Breaker Service** (`circuit-breaker-service.ts`): 6 breaker types; in-memory state machine with DB persistence; streak tracking for loss and execution failures
- **Correlation Engine** (`correlation-engine.ts`): Pearson correlation matrices from daily OHLCV closes; configurable rolling window (default 30 days); correlation risk score (mean absolute off-diagonal coefficient)
- **Strategy Risk Scorer** (`strategy-risk-scorer.ts`): 9-component scoring (win rate, drawdown, Sharpe, consistency, frequency, exposure, overall, health, confidence) from backtest history
- **Drawdown Monitor** (`drawdown-monitor.ts`): daily/weekly/account drawdown monitoring with warning/restriction/halt tiers; automatic deduplication of open events
- **Risk Scheduler** (`risk-scheduler.ts`): 5 independent polling loops — risk snapshots (10 min), correlation (6 h), strategy scoring (1 h), exposure/drawdown (5 min), circuit breaker monitor (2 min)
- **Risk DB Layer** (`risk-db.ts`): full CRUD and query layer for all 12 risk tables
- **14 new risk API route handlers** across 8 route files: profiles CRUD, decisions list, events/violations/snapshots, correlations, strategies, circuit breakers, kill switch, audit log
- **20 new OpenAPI path entries** under `/v1/risk/` with full schema definitions
- **30+ new OpenAPI component schemas** for all risk domain objects
- **Paper trading integration**: every BUY and SELL signal in `paper-signal-engine.ts` now passes through `evaluateOrder()` before execution; rejected orders are persisted with reason but never reach the execution engine
- Startup seeding of 4 default risk profiles (idempotent)
- Risk scheduler started alongside paper scheduler on server boot

#### Changed
- `paper-signal-engine.ts`: BUY and SELL flows now call Phase 6 `evaluateOrder()` pre-trade check
- `index.ts`: added `seedDefaultRiskProfiles()` and `startRiskScheduler()` to startup sequence
- `routes/v1/index.ts`: all 8 Phase 6 route files mounted under v1 router
- OpenAPI spec version bumped from 0.5.0 → 0.6.0
- API description updated to mention risk engine
- `lib/db/src/schema/index.ts`: Phase 6 schema exports added

---

## [0.5.0] — 2026-06-01

### Phase 5 — Institutional Paper Trading Environment

#### Added

**Database Tables (10 new)**
- `paper_accounts` — virtual accounts with equity, cash balance, realized/unrealized P&L, buying power, and status (active/paused/closed)
- `paper_portfolios` — portfolio-level metrics: open/closed position counts, total exposure, allocation %, peak equity, current and max drawdown, daily return
- `paper_positions` — per-account, per-strategy position tracking: side, quantity, entry/current/exit price, market value, unrealized/realized P&L, commission, slippage
- `paper_orders` — full order lifecycle: order type, side, quantity, fill qty, limit/stop prices, avg fill price, status, reject reason, signal tag, market price at submission
- `paper_fills` — immutable fill records: raw price, fill price (post-slippage), commission, slippage, latency ms
- `paper_executions` — execution engine audit log: success flag, failure reason, executed price/qty, commission, slippage, latency per order attempt
- `paper_trade_history` — closed trade P&L archive: gross PnL, net PnL, commission, slippage, duration, entry/exit signal, trade date
- `paper_daily_snapshots` — EOD equity snapshots: equity, cash, position value, daily realized P&L, unrealized P&L, daily return %, drawdown %, open positions, trades closed
- `paper_strategy_assignments` — strategy ↔ account bindings: interval, param overrides (JSON), status (active/paused/disabled), lifecycle timestamps
- `paper_alerts` — operational alert log: type (large_drawdown/strategy_failure/position_concentration/equity_threshold/missed_data/execution_failure), severity (info/warning/critical), payload JSON, acknowledged flag

**Core Services (9 new)**
- `paper-accounts-db.ts` — complete CRUD data access layer for all 10 paper trading tables; typed Drizzle queries throughout
- `paper-execution-engine.ts` — realistic fill simulation: percentage slippage, percentage commission, latency jitter (10–100ms); returns `ExecutionResult` with `rawPrice`, `executedPrice`, `filledQuantity`, `commission`, `slippage`, `latencyMs`, `success`
- `paper-position-manager.ts` — `openPaperPosition()` and `closePaperPosition()` with P&L computation; updates account cash balance and realized P&L atomically
- `paper-portfolio-tracker.ts` — `markToMarket()` updates unrealized P&L and market value for all open positions; `refreshPortfolio()` recomputes exposure, allocation, and drawdown
- `paper-performance.ts` — `computePaperPerformance()`: time-windowed returns (daily/weekly/monthly/YTD), Sharpe ratio, max drawdown, win rate, profit factor, average trade P&L, largest win/loss, total commission and slippage
- `paper-alert-manager.ts` — `checkDrawdownAlert()`, `checkConcentrationAlert()`, `alertExecutionFailure()`, `alertMissedData()`; deduplication via 24h lookback
- `paper-snapshot-service.ts` — `takeSnapshot()` aggregates EOD account state into `paper_daily_snapshots`; `getSnapshots()` ordered by date desc
- `paper-signal-engine.ts` — `runSignalForAssignment()`: fetches candles → runs strategy → BUY (open position) or SELL (close position) → create order → execute → fill → update account → refresh portfolio; 10% of available cash per trade
- `paper-scheduler.ts` — `startPaperScheduler()`: four independent `setInterval` loops — signal polling (default 5 min), MTM (2 min), snapshots (6 h), alert sweeps (10 min); graceful shutdown support

**API Endpoints (9 new route files, 15 endpoint entries)**
- `POST /v1/paper/accounts` — create virtual paper account with initial capital
- `GET /v1/paper/accounts` — list accounts (optional status filter)
- `GET /v1/paper/accounts/:id` — account detail with portfolio summary
- `POST /v1/paper/strategies/assign` — assign strategy + symbol + interval to an account
- `POST /v1/paper/strategies/pause` — pause active assignment (with optional reason)
- `POST /v1/paper/strategies/resume` — resume paused assignment
- `GET /v1/paper/strategies/assignments` — list assignments (accountId + status filters)
- `GET /v1/paper/positions` — list open or closed positions for an account
- `GET /v1/paper/orders` — list orders with status filter
- `GET /v1/paper/fills` — list fill records for an account
- `GET /v1/paper/portfolio` — portfolio summary with all open positions (mark-to-market)
- `GET /v1/paper/performance` — time-windowed performance analytics (Sharpe, drawdown, win rate, etc.)
- `GET /v1/paper/alerts` — operational alert log with severity + acknowledged filters
- `GET /v1/paper/snapshots` — daily equity snapshot history (up to 365 days)
- `POST /v1/paper/snapshots/trigger` — manually trigger a daily snapshot for an account

**OpenAPI Spec**
- `paper` tag added with description
- 9 path group entries covering all 15 endpoint variants
- 30 new component schemas: `CreatePaperAccountRequest`, `PaperAccount`, `PaperPortfolio`, `PaperPosition`, `PaperOrder`, `PaperFill`, `PaperStrategyAssignment`, `PaperAlert`, `PaperDailySnapshot`, `PaperPerformanceMetrics`, `TriggerPaperSnapshotRequest`, plus all response wrappers and enum types
- Codegen regenerated (Zod validators + React Query hooks)
- Version bumped to `0.5.0`

**Startup**
- `startPaperScheduler()` called in `artifacts/api-server/src/index.ts` after DB initialization

#### Fixed
- OpenAPI codegen conflict (`TriggerPaperSnapshotBody` ambiguity) resolved by converting inline request body schema to a named `$ref` in `components/schemas`

---

## [0.4.0] — 2026-06-01

### Phase 4 — Professional Backtesting & Validation Engine

#### Added

**Database Tables (8 new)**
- `trade_cost_models` — named commission + slippage configuration profiles (flat, percentage, maker_taker, fixed, percentage, volatility-based, volume-based)
- `position_sizing_profiles` — named position sizing strategy profiles (5 methods: fixed_dollar, fixed_percentage, risk_percentage, volatility_based, kelly)
- `portfolio_backtests` — multi-symbol portfolio backtest runs with per-symbol capital allocation and portfolio-level metrics JSON blob
- `equity_curves` — compact JSON equity time-series storage for both single-strategy and portfolio backtests
- `walk_forward_runs` — walk-forward validation orchestration: rolling and expanding window types, per-window IS/OOS results, consistency scoring
- `monte_carlo_runs` — Monte Carlo simulation results with percentile distribution, probability of ruin, and seeded reproducibility
- `validation_results` — structured strategy validation reports with 5 red-flag indicators, letter grade (A–F), and recommendation text
- `research_snapshots` — named research configuration snapshots for reproducibility and recall

**Extended `performance_metrics` Table**
- 10 new columns: `calmar_ratio`, `recovery_factor`, `ulcer_index`, `mar_ratio`, `exposure_time_pct`, `avg_trade_duration_days`, `ulcer_performance_index`, `probability_of_ruin`, `total_commission`, `total_slippage`

**Core Services (3 new)**
- `cost-model.ts` — commission and slippage engine; 5 preset exchange profiles (Binance Spot, Binance Futures, Forex ECN, US Stocks, Zero Cost); `applySlippage()` and `computeRoundTripCost()` helpers
- `position-sizer.ts` — 5 position sizing methods; ATR computation (Wilder's smoothing); Kelly Criterion formula; hard cap enforcement via `maxPositionPct`
- `advanced-metrics.ts` — Calmar Ratio, Recovery Factor, Ulcer Index, MAR Ratio, Exposure Time %, Average Trade Duration (days), Ulcer Performance Index

**Upgraded Services (3 updated)**
- `backtesting-engine.ts` — integrated CostModel + PositionSizer; per-trade commission and slippage tracking; exports `BacktestOutputExtended` with `totalCommission` and `totalSlippage`; Phase 3 backward-compatible via `positionSizeFraction` shim
- `performance-calculator.ts` — extended `ComputedMetrics` with all 10 Phase 4 fields; delegates advanced metrics to `advanced-metrics.ts`; `totalCommission` / `totalSlippage` threaded through from engine
- `research-runner.ts` — threads `costModel` and `positionSizing` options through to the backtesting engine; saves equity curve after each run

**New Services (4 new)**
- `portfolio-engine.ts` — multi-symbol portfolio simulation; equal capital allocation; per-symbol independent backtest; portfolio equity curve by timestamp-aligned merge; portfolio-level aggregated metrics
- `equity-curve-service.ts` — compact JSON storage and retrieval of equity time-series; `{ t, e, d }` format; supports both single-strategy and portfolio backtest curves
- `walk-forward-runner.ts` — rolling and expanding window split; parallel IS/OOS backtest execution per window; consistency score (OOS/IS ratio); pass/fail validation
- `monte-carlo-runner.ts` — seeded mulberry32 PRNG for reproducibility; trade-sequence shuffling; percentile computation (p5–p95); probability of ruin estimation
- `validation-engine.ts` — 5 checks: trade count, sample size, drawdown, negative expectancy, overfitting (IS vs OOS Sharpe), instability (OOS return variance); A–F grading
- `phase4-db.ts` — complete data access layer for all Phase 4 tables; rankings query (Sharpe-sorted)

**API Endpoints (9 new)**
- `POST /v1/research/portfolio-backtest` — run strategy across multiple symbols with optional cost model and position sizing
- `GET /v1/research/portfolio-backtest/:id` — portfolio run detail with portfolio metrics and equity curve
- `POST /v1/research/walk-forward` — walk-forward validation (rolling or expanding, 2–20 windows)
- `GET /v1/research/walk-forward/:id` — walk-forward detail with all per-window results
- `POST /v1/research/monte-carlo` — Monte Carlo simulation on a completed backtest's trades (100–10,000 simulations)
- `GET /v1/research/monte-carlo/:id` — simulation detail with percentile distribution
- `GET /v1/research/equity-curve/:id` — equity curve for any completed run (expanded or compact format)
- `POST /v1/research/validation` — generate strategy validation report from backtest + optional walk-forward data
- `GET /v1/research/validation/:id` — retrieve most recent validation result for a run
- `GET /v1/research/rankings` — Sharpe-sorted leaderboard across all completed backtests (up to 100)

**OpenAPI Spec**
- 9 new path entries with full request/response schemas
- 16 new component schemas: `CostModelInput`, `PositionSizingInput`, `PortfolioBacktestRequest`, `PortfolioBacktestJobResult`, `PortfolioMetrics`, `SymbolResult`, `PortfolioBacktestDetailResponse`, `WalkForwardRequest`, `WalkForwardJobResult`, `WalkForwardWindowResult`, `WalkForwardDetailResponse`, `MonteCarloRequest`, `MonteCarloJobResult`, `MonteCarloPercentiles`, `MonteCarloDetailResponse`, `EquityCurvePoint`, `EquityCurveResponse`, `ValidationRequest`, `ValidationFinding`, `ValidationDetailResponse`, `RankedResult`, `RankingsResponse`
- `PerformanceMetrics` schema extended with 10 new Phase 4 fields
- Codegen regenerated (Zod schemas + React Query hooks)

#### Changed
- `backtesting-engine.ts` — added cost model and position sizing integration; trades now include commission, slippage, grossPnl, netPnl fields
- `performance-calculator.ts` — extended return type with Phase 4 metrics; signature updated to accept `totalCommission` and `totalSlippage`
- `research-runner.ts` — now saves equity curve after each run; threads Phase 4 options to engine
- `research-db.ts` — `savePerformanceMetrics` updated to persist all 10 new Phase 4 metric columns
- `lib/db/src/schema/index.ts` — exports all 8 new Phase 4 schema files

#### Fixed
- OpenAPI codegen conflict (`GetEquityCurveParams` ambiguity between zod api.ts value export and types/ type export) resolved by removing duplicate query params from the equity curve GET spec; query params still supported at runtime

---

## [0.3.0] — 2026-06-01

### Phase 3 — Quant Research Laboratory & Backtesting Foundation

#### Added

**Database Tables**
- `strategy_definitions` — catalog of registered research strategies with parameter schemas, version tracking, and active/inactive state
- `strategy_versions` — immutable snapshot history of strategy parameter schemas; allows backtest reproducibility by schema version
- `backtest_runs` — one row per backtest execution with full lifecycle state machine (pending → running → completed | failed), date range, parameters, and candles-processed count
- `backtest_trades` — simulated trades produced by the backtesting engine; captures entry/exit time, price, quantity, P&L, signals, and candle indices
- `performance_metrics` — risk-adjusted performance metrics for each completed backtest run (1:1 with backtest_runs, unique index enforced)

**Strategy Framework** (`artifacts/api-server/src/strategies/`)
- `types.ts` — core interfaces: `IStrategy`, `OhlcvCandle`, `Signal` (BUY/SELL/HOLD), `StrategyContext`, `ParameterSchema`, `SimulatedTrade`, `BacktestOutput`
- `base.ts` — `BaseStrategy` abstract class with parameter resolution, lifecycle hooks, and helper methods
- `indicators.ts` — pure technical indicator library: SMA, EMA, RSI, MACD, Bollinger Bands, standard deviation, downside deviation
- `ema-crossover.ts` — EMA Crossover strategy: BUY when fast EMA crosses above slow EMA, SELL on reverse crossover
- `rsi-mean-reversion.ts` — RSI Mean Reversion strategy: BUY below oversold threshold, SELL above overbought threshold
- `macd-trend.ts` — MACD Trend Following strategy: BUY on MACD/signal line bullish crossover, SELL on bearish crossover
- `bollinger-bands-strategy.ts` — Bollinger Bands strategy: BUY when price closes below lower band, SELL above upper band
- `registry.ts` — strategy registry with factory pattern; `createStrategy()`, `getAllStrategies()`, `resolveParams()`

**Backtesting Engine** (`artifacts/api-server/src/services/`)
- `backtesting-engine.ts` — chronological candle replay engine; zero look-ahead bias; signal execution at next candle open for fill realism; mark-to-market equity curve; force-closes open position at end of window
- `performance-calculator.ts` — computes: total return, CAGR, win rate, profit factor, avg win/loss, max drawdown, Sharpe ratio, Sortino ratio, trade counts, expectancy
- `research-db.ts` — data access layer for all Phase 3 tables; `seedStrategyDefinitions()`, `createBacktestRun()`, `saveBacktestTrades()`, `savePerformanceMetrics()`, `listPerformanceResults()`, `compareRuns()`
- `research-runner.ts` — orchestrates full backtest job: validate → create DB record → load candles → run engine → calculate metrics → persist → update status
- `comparison-engine.ts` — side-by-side comparison of 2+ backtest runs across 11 performance metrics with per-metric winner detection and overall winner scoring

**API Endpoints (Phase 3)**
- `GET /api/v1/research/strategies` — list all active strategies with parameter schemas
- `POST /api/v1/research/backtest` — run a backtest (strategyName, symbol, interval, startDate, endDate, params, initialCapital)
- `GET /api/v1/research/backtest/:id` — get a specific run with trades and performance metrics
- `GET /api/v1/research/runs` — list backtest runs with filters (strategyName, symbol, status, limit)
- `GET /api/v1/research/results` — list completed run metrics joined with run metadata
- `GET /api/v1/research/compare?ids=id1,id2` — side-by-side comparison of multiple runs

**OpenAPI / Codegen**
- OpenAPI spec updated to version 0.3.0 with full research path and schema definitions
- `research` tag added to API spec
- 11 new schemas: `ResearchStrategy`, `BacktestRequest`, `BacktestJobResult`, `BacktestRun`, `BacktestTrade`, `PerformanceMetrics`, `BacktestDetailResponse`, `ResearchResult`, `MetricComparison`, `ComparisonRunSummary`, `ComparisonResponse`
- Codegen regenerated: `lib/api-zod` and `lib/api-client-react` updated

**Infrastructure**
- `zod` added as an explicit direct dependency of `@workspace/api-server` (previously relied on transitive resolution via `@workspace/db`)
- Strategy definitions auto-seeded to `strategy_definitions` table on every server startup (idempotent upsert)

#### Changed
- `lib/db/src/schema/index.ts` — added exports for all 5 new Phase 3 schema modules
- `artifacts/api-server/src/routes/v1/index.ts` — registered 5 Phase 3 route modules
- `artifacts/api-server/src/index.ts` — added `seedStrategyDefinitions()` call to startup sequence

#### Fixed
- Nothing

#### Removed
- Nothing

---

## [0.2.0] — 2026-05-31

### Phase 2 — Multi-Market Architecture

#### Added
- Multi-provider data ingestion architecture (Forex, Stocks, Commodities alongside Crypto)
- `ingestion_jobs` table — structured job tracking replacing flat log pattern
- `market_providers` table — provider-to-market mapping
- `provider_health` table — time-series health check results
- `data_quality_checks` table — automated validation results
- `economic_events` table — global economic calendar
- `news_items` table — financial news metadata
- `market_metadata` table — extended market attributes (sector, currency, timezone, market cap)
- `GET /v1/ingestion/jobs` — structured ingestion job list with rich filters
- `GET /v1/providers` — full provider registry
- `GET /v1/providers/health` — provider health records
- `GET /v1/market-registry` — enriched market + provider data
- `GET /v1/data-quality` — data quality check results
- `GET /v1/economic-events` — economic calendar events
- `GET /v1/news` — financial news items
- OpenAPI spec v0.2.0 with all Phase 2 schemas

---

## [0.1.0] — 2026-05-31

### Phase 0 — Repository Foundation

#### Added
- `README.md` — Project overview, vision, objectives, repository structure, roadmap summary, and technology stack
- `PROJECT_MASTER.md` — Project brain: vision, long-term goals, scope, non-goals, current phase, future phases, architecture overview, security principles, development principles, deployment principles, project constraints, and risk management principles
- `AGENTS.md` — Mandatory AI agent operating instructions: pre-coding and post-coding protocols, hard rules, architecture rules, phase awareness, coding standards
- `RULES.md` — Development rules and standards
- `TODO.md` — Phased roadmap covering Phases 0–10
- `CHANGELOG.md` — This file
- `DECISIONS.md` — Architecture decision records
- `SECURITY.md` — Security policy
- `CONTRIBUTING.md` — Contribution guidelines
- `.env.example` — Environment variable template
- `.gitignore` — Git ignore rules
- `docs/` directory with 10 architecture documents
- `frontend/`, `backend/`, `database/`, `strategies/`, `tests/`, `scripts/`, `infrastructure/` directory skeletons
- `.github/` templates (bug report, feature request, pull request)

---

## Version History

| Version | Date | Phase | Description |
|---------|------|-------|-------------|
| 0.9.0 | 2026-06-01 | Phase 9 | Real-Time Market Streaming & Event Infrastructure |
| 0.8.0 | 2026-06-01 | Phase 8 | AI Research Assistant & Quant Intelligence Layer |
| 0.7.0 | 2026-06-01 | Phase 7 | Portfolio Intelligence & Analytics Platform |
| 0.6.0 | 2026-06-01 | Phase 6 | Institutional Risk Engine & Capital Protection Layer |
| 0.5.0 | 2026-06-01 | Phase 5 | Institutional Paper Trading Environment |
| 0.4.0 | 2026-06-01 | Phase 4 | Professional Backtesting & Validation Engine |
| 0.3.0 | 2026-06-01 | Phase 3 | Quant Research Laboratory & Backtesting Foundation |
| 0.2.0 | 2026-05-31 | Phase 2 | Multi-market architecture, providers, data quality |
| 0.1.0 | 2026-05-31 | Phase 0 | Repository foundation and project operating system |
