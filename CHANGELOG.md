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
| 0.3.0 | 2026-06-01 | Phase 3 | Quant Research Laboratory & Backtesting Foundation |
| 0.2.0 | 2026-05-31 | Phase 2 | Multi-market architecture, providers, data quality |
| 0.1.0 | 2026-05-31 | Phase 0 | Repository foundation and project operating system |
