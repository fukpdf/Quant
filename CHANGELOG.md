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
