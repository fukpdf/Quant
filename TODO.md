# TODO.md — QuantForge Phased Roadmap

> Last updated: 2026-06-01
> Current phase: **Phase 7 — Portfolio Intelligence & Analytics Platform** ✅ COMPLETE

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
- [x] Total Return
- [x] Annualized Return (CAGR)
- [x] Win Rate
- [x] Profit Factor
- [x] Average Win / Average Loss
- [x] Maximum Drawdown
- [x] Sharpe Ratio (annualized)
- [x] Sortino Ratio (annualized)
- [x] Trade Count (total, winning, losing)
- [x] Expectancy

### Research Infrastructure
- [x] Research runner service (executeBacktest)
- [x] Strategy definitions auto-seeded to DB on startup
- [x] Comparison engine (side-by-side multi-run comparison)

### API Endpoints (Phase 3)
- [x] `GET /v1/research/strategies` — list registered strategies with parameter schemas
- [x] `POST /v1/research/backtest` — run a backtest
- [x] `GET /v1/research/backtest/:id` — get run detail with trades and metrics
- [x] `GET /v1/research/runs` — list all backtest runs with filters
- [x] `GET /v1/research/results` — list completed run metrics
- [x] `GET /v1/research/compare` — side-by-side comparison of multiple runs

### OpenAPI & Codegen
- [x] OpenAPI spec updated with all research paths and schemas
- [x] Codegen regenerated (Zod schemas + React Query hooks)
- [x] Zod added as explicit api-server dependency

---

## Phase 4 — Professional Backtesting & Validation Engine ✅ COMPLETE

**Goal**: Upgrade the research platform to institutional-grade backtesting with realistic cost modeling, professional risk metrics, portfolio simulation, and statistical validation.

### Database Tables (8 new)
- [x] `trade_cost_models` — commission + slippage configuration profiles
- [x] `position_sizing_profiles` — position sizing strategy profiles (5 methods)
- [x] `portfolio_backtests` — multi-symbol portfolio backtest runs
- [x] `equity_curves` — compact equity time-series storage
- [x] `walk_forward_runs` — walk-forward validation orchestration
- [x] `monte_carlo_runs` — Monte Carlo simulation results
- [x] `validation_results` — strategy validation reports with A–F grading
- [x] `research_snapshots` — named research configuration snapshots
- [x] `performance_metrics` extended with 10 new Phase 4 columns

### Cost & Execution Modeling
- [x] Configurable commission models: flat, percentage, maker_taker
- [x] Slippage models: fixed, percentage, volatility-based, volume-based
- [x] 5 exchange preset profiles (Binance Spot, Binance Futures, Forex ECN, US Stocks, Zero Cost)
- [x] Per-trade cost tracking (commission + slippage) in backtesting engine

### Position Sizing Framework
- [x] Fixed Dollar sizing
- [x] Fixed Percentage sizing
- [x] Risk Percentage sizing (ATR-based stop)
- [x] Volatility-Based sizing (inverse ATR)
- [x] Kelly Criterion (fractional Kelly with configurable multiplier)
- [x] Hard cap enforcement (`maxPositionPct`)

### Advanced Performance Metrics
- [x] Calmar Ratio (CAGR / Max Drawdown)
- [x] Recovery Factor (Total Return / Max Drawdown)
- [x] Ulcer Index (RMS of drawdown time-series)
- [x] MAR Ratio
- [x] Exposure Time % (fraction of candles in position)
- [x] Average Trade Duration (days)
- [x] Ulcer Performance Index (Return / Ulcer Index)
- [x] Total Commission + Total Slippage tracking

### Portfolio Engine
- [x] Multi-symbol portfolio simulation (up to 20 symbols)
- [x] Equal capital allocation across symbols
- [x] Per-symbol independent backtesting
- [x] Portfolio equity curve (timestamp-aligned merge)
- [x] Portfolio-level aggregated metrics

### Walk-Forward Validation
- [x] Rolling window walk-forward
- [x] Expanding window walk-forward
- [x] IS/OOS split with configurable fraction (40%–95%)
- [x] Per-window Sharpe and return tracking
- [x] Consistency score (OOS/IS ratio)
- [x] Automatic pass/fail determination

### Monte Carlo Analysis
- [x] Trade sequence shuffling simulation (100–10,000 iterations)
- [x] Seeded PRNG for reproducibility
- [x] Percentile distribution (p5, p10, p25, p50, p75, p90, p95)
- [x] Probability of ruin estimation

### Validation Engine
- [x] Trade count check (< 10 trades = critical)
- [x] Sample size check (< 30 trades = warning)
- [x] Excessive drawdown check (> 30% = warning/critical)
- [x] Negative expectancy check
- [x] Overfitting detection (IS vs OOS Sharpe ratio)
- [x] Strategy instability detection (OOS return variance)
- [x] A–F letter grading system
- [x] Structured findings with severity levels

### API Endpoints (9 new)
- [x] `POST /v1/research/portfolio-backtest`
- [x] `GET /v1/research/portfolio-backtest/:id`
- [x] `POST /v1/research/walk-forward`
- [x] `GET /v1/research/walk-forward/:id`
- [x] `POST /v1/research/monte-carlo`
- [x] `GET /v1/research/monte-carlo/:id`
- [x] `GET /v1/research/equity-curve/:id`
- [x] `POST /v1/research/validation`
- [x] `GET /v1/research/validation/:id`
- [x] `GET /v1/research/rankings`

### OpenAPI & Codegen
- [x] 9 new path entries
- [x] 22 new component schemas
- [x] PerformanceMetrics schema extended (10 new fields)
- [x] Codegen regenerated (Zod + React Query)

---

## Phase 5 — Institutional Paper Trading Environment ✅ COMPLETE

**Goal**: Real-time strategy execution simulation against live market data with virtual account management, automated signal routing, and institutional-grade performance analytics.

### Database Tables (10 new)
- [x] `paper_accounts` — virtual trading accounts with equity and cash balance tracking
- [x] `paper_portfolios` — portfolio-level metrics (exposure, drawdown, allocation)
- [x] `paper_positions` — open/closed position tracking per account + strategy
- [x] `paper_orders` — order lifecycle management (pending → submitted → filled)
- [x] `paper_fills` — immutable fill records with slippage + commission detail
- [x] `paper_executions` — execution engine audit log per order attempt
- [x] `paper_trade_history` — closed trade P&L history for performance analytics
- [x] `paper_daily_snapshots` — end-of-day equity snapshots for time-series analytics
- [x] `paper_strategy_assignments` — strategy ↔ account bindings with pause/resume lifecycle
- [x] `paper_alerts` — operational alert log (drawdown, execution failure, concentration)

### Core Services (9 new)
- [x] `paper-accounts-db.ts` — full CRUD data access layer for all 10 paper trading tables
- [x] `paper-execution-engine.ts` — realistic fill simulation (slippage, commission, latency jitter)
- [x] `paper-position-manager.ts` — position open/close with P&L computation and account balance update
- [x] `paper-portfolio-tracker.ts` — mark-to-market, portfolio refresh, drawdown tracking
- [x] `paper-performance.ts` — time-windowed returns (daily/weekly/monthly/YTD), Sharpe, win rate, profit factor
- [x] `paper-alert-manager.ts` — drawdown alerts, concentration warnings, execution failure notifications
- [x] `paper-snapshot-service.ts` — daily equity snapshot capture and retrieval
- [x] `paper-signal-engine.ts` — strategy → account signal routing (BUY/SELL → order → fill → position)
- [x] `paper-scheduler.ts` — interval scheduler: signal polling, MTM, snapshots, alert sweeps

### API Endpoints (9 new)
- [x] `POST /v1/paper/accounts` — create virtual paper account
- [x] `GET /v1/paper/accounts` — list accounts with optional status filter
- [x] `GET /v1/paper/accounts/:id` — account detail with portfolio summary
- [x] `POST /v1/paper/strategies/assign` — assign a strategy to an account
- [x] `POST /v1/paper/strategies/pause` — pause active strategy assignment
- [x] `POST /v1/paper/strategies/resume` — resume paused strategy assignment
- [x] `GET /v1/paper/strategies/assignments` — list assignments with filters
- [x] `GET /v1/paper/positions` — list open/closed positions per account
- [x] `GET /v1/paper/orders` — list orders with status filter
- [x] `GET /v1/paper/fills` — list fill records per account
- [x] `GET /v1/paper/portfolio` — portfolio summary with open positions
- [x] `GET /v1/paper/performance` — time-windowed performance analytics
- [x] `GET /v1/paper/alerts` — operational alert log
- [x] `GET /v1/paper/snapshots` — daily equity snapshot history
- [x] `POST /v1/paper/snapshots/trigger` — manually trigger a snapshot

### OpenAPI & Codegen
- [x] `paper` tag added to spec
- [x] 9 path groups + 30 component schemas added
- [x] Codegen regenerated (Zod schemas + React Query hooks)
- [x] DB schema pushed (`pnpm --filter @workspace/db run push`)

---

## Phase 6 — Institutional Risk Engine & Capital Protection Layer ✅ COMPLETE

**Goal**: Enforce position sizing, exposure limits, and drawdown circuit breakers before any order is executed. The central risk authority of the platform.

### Database Tables (12 new)
- [x] `risk_profiles` — named capital protection profiles (Conservative/Balanced/Aggressive/Research/Custom)
- [x] `risk_rules` — individual risk rules attached to profiles with priority ordering
- [x] `risk_decisions` — immutable pre-trade decision log (approved/rejected/requires_review)
- [x] `risk_events` — operational risk events with severity (info/warning/critical)
- [x] `risk_violations` — confirmed rule breach records
- [x] `portfolio_risk_snapshots` — periodic portfolio risk state (exposure, concentration, drawdown, health score)
- [x] `strategy_risk_scores` — computed strategy risk/health/confidence scores from backtest history
- [x] `correlation_matrices` — Pearson correlation matrix snapshots (NxN asset pairs)
- [x] `drawdown_events` — drawdown threshold breach events with action tracking
- [x] `circuit_breaker_events` — circuit breaker state transitions with recovery tracking
- [x] `kill_switch_events` — kill switch activations and resumptions (immutable audit trail)
- [x] `risk_audit_log` — immutable audit log for all risk system actions

### Core Services (9 new)
- [x] `risk-db.ts` — full CRUD data access layer for all 12 risk tables
- [x] `risk-profile-service.ts` — profile management and seeding of 4 default profiles
- [x] `risk-engine.ts` — pre-trade gatekeeper with 13 sequential risk checks
- [x] `circuit-breaker-service.ts` — 6 circuit breaker types with in-memory state + DB persistence
- [x] `kill-switch-service.ts` — in-memory kill switch with scope-based control (trading/account/strategy/portfolio/scheduler)
- [x] `correlation-engine.ts` — Pearson correlation matrix computation from daily OHLCV data
- [x] `strategy-risk-scorer.ts` — 9-component strategy risk scoring from backtest history
- [x] `drawdown-monitor.ts` — multi-horizon drawdown monitoring (daily/weekly/account) with tiered actions
- [x] `risk-scheduler.ts` — 5 independent risk monitoring loops (snapshots, correlation, scoring, exposure, circuit breakers)

### Pre-Trade Risk Engine (13 checks in order)
- [x] Global trading kill switch check
- [x] Account-level kill switch check
- [x] Strategy-level kill switch check
- [x] Circuit breaker state check
- [x] Account status and existence check
- [x] Position size limit (% of equity)
- [x] Portfolio exposure limit (total exposure vs equity)
- [x] Daily loss limit (P&L vs threshold)
- [x] Account drawdown limit (peak-to-current)
- [x] Concentration limit (single asset % of portfolio)
- [x] Max open positions limit
- [x] Strategy confidence score gate
- [x] Data freshness check (candle age in minutes)

### Risk Profiles (4 defaults seeded on startup)
- [x] Conservative (5% position, 50% exposure, 1% daily loss, 10% max drawdown)
- [x] Balanced (10% position, 75% exposure, 2% daily loss, 15% max drawdown) — default
- [x] Aggressive (20% position, 95% exposure, 5% daily loss, 30% max drawdown)
- [x] Research (25% position, 100% exposure, 10% daily loss, 50% max drawdown)

### Circuit Breakers (6 types)
- [x] `loss_streak` — N consecutive losing trades (threshold: 5)
- [x] `drawdown` — account drawdown exceeds threshold (threshold: 15%)
- [x] `execution_failure` — N consecutive fill failures (threshold: 3)
- [x] `volatility` — market volatility exceeds threshold (placeholder)
- [x] `data_failure` — data staleness / missing candles
- [x] `market_closure` — market detected as closed (placeholder)

### Kill Switch System
- [x] Global trading halt (`trading` scope)
- [x] Scheduler pause (`scheduler` scope)
- [x] Per-account halt (`account` scope)
- [x] Per-strategy halt (`strategy` scope)
- [x] Portfolio-level halt (`portfolio` scope)
- [x] Full audit trail in `kill_switch_events` table
- [x] Immediate in-memory effect (no DB round-trip on order checks)

### API Endpoints (14 new)
- [x] `GET /v1/risk/profiles` — list risk profiles
- [x] `POST /v1/risk/profiles` — create risk profile
- [x] `GET /v1/risk/profiles/:id` — get profile by ID
- [x] `PATCH /v1/risk/profiles/:id` — update profile
- [x] `GET /v1/risk/decisions` — list pre-trade decisions (filterable by account, decision type, strategy)
- [x] `GET /v1/risk/events` — list risk events (filterable by severity, resolved status)
- [x] `GET /v1/risk/violations` — list rule violations
- [x] `GET /v1/risk/snapshots` — portfolio risk snapshots per account
- [x] `GET /v1/risk/drawdown-events` — drawdown threshold breach events
- [x] `GET /v1/risk/correlations` — list correlation matrices
- [x] `POST /v1/risk/correlations/compute` — trigger correlation computation
- [x] `GET /v1/risk/strategies` — list strategy risk scores
- [x] `GET /v1/risk/strategies/:name` — get strategy risk score
- [x] `POST /v1/risk/strategies/score` — trigger strategy risk scoring
- [x] `GET /v1/risk/circuit-breakers` — circuit breaker states + recent events
- [x] `POST /v1/risk/circuit-breakers/reset` — manually reset a triggered breaker
- [x] `GET /v1/risk/kill-switch` — current kill switch status
- [x] `POST /v1/risk/kill-switch` — activate kill switch
- [x] `POST /v1/risk/resume` — resume (deactivate) kill switch
- [x] `GET /v1/risk/audit-log` — immutable risk audit log

### Paper Trading Integration
- [x] `paper-signal-engine.ts` — BUY and SELL orders both pass through `evaluateOrder()` before execution
- [x] Rejected orders are marked with `status: "rejected"` and `rejectReason` prefixed with "Risk engine: ..."
- [x] Orders that pass risk checks proceed to execution engine as before

### OpenAPI & Codegen
- [x] `risk` tag added to spec
- [x] Version bumped to 0.6.0
- [x] 20 path entries added
- [x] 30+ component schemas added
- [x] Codegen regenerated (Zod schemas + React Query hooks)
- [x] DB schema pushed (`pnpm --filter @workspace/db run push`)

---

## Phase 7 — Portfolio Intelligence & Analytics Platform ✅ COMPLETE

**Goal**: Comprehensive performance measurement, attribution, health scoring, and rule-based portfolio recommendations.

### Database Schema (12 tables)
- [x] `portfolio_analytics` — per-account analytics snapshots
- [x] `portfolio_performance` — TWR/MWR/Sharpe/Sortino/Calmar/Alpha/Beta/IR/MaxDD
- [x] `portfolio_benchmarks` — BTC/ETH/SOL/custom basket benchmark definitions
- [x] `portfolio_attribution` — top-level attribution per account per period
- [x] `strategy_attribution` — per-strategy return attribution
- [x] `asset_attribution` — per-asset return attribution
- [x] `portfolio_health_scores` — composite health score (0–100) across 5 dimensions
- [x] `portfolio_recommendations` — rule-based actionable recommendations
- [x] `allocation_snapshots` — point-in-time portfolio composition snapshots
- [x] `benchmark_snapshots` — benchmark price/return snapshots
- [x] `performance_periods` — computed return periods (1d/7d/30d/90d/1y)
- [x] `analytics_audit_log` — event log for all analytics computations

### Services
- [x] `performance-engine.ts` — TWR, MWR, Sharpe, Sortino, Calmar, Alpha, Beta, IR, Max Drawdown
- [x] `benchmark-service.ts` — BTC/ETH/SOL seed + benchmark snapshot refresh
- [x] `attribution-engine.ts` — Brinson-Hood-Beebower style strategy + asset attribution
- [x] `health-engine.ts` — composite health score across diversification, performance, risk, activity, drawdown
- [x] `diversification-engine.ts` — HHI, asset concentration, strategy concentration, correlation-adjusted score
- [x] `allocation-tracker.ts` — hourly snapshots, drift detection vs. target weights
- [x] `recommendation-engine.ts` — rule-based: rebalance, concentration, diversification, drawdown, idle capital
- [x] `analytics-scheduler.ts` — 6 background loops (performance daily, health hourly, attribution daily, allocation 15m, benchmarks 6h, audit cleanup)
- [x] `analytics-db.ts` — unified DB helper for all analytics read/write
- [x] `types-analytics.ts` — shared TypeScript types

### API Endpoints (10 route files, 27 endpoints)
- [x] `GET /api/v1/portfolio/analytics/:accountId` — latest analytics snapshot
- [x] `POST /api/v1/portfolio/analytics/:accountId/compute` — trigger on-demand computation
- [x] `GET /api/v1/portfolio/performance/:accountId` — performance metrics (TWR/MWR/ratios)
- [x] `GET /api/v1/portfolio/performance/:accountId/periods` — performance by time period
- [x] `GET /api/v1/portfolio/health/:accountId` — latest health score
- [x] `GET /api/v1/portfolio/health/:accountId/history` — health score history
- [x] `GET /api/v1/portfolio/attribution/:accountId` — latest attribution
- [x] `GET /api/v1/portfolio/attribution/:accountId/strategies` — per-strategy attribution
- [x] `GET /api/v1/portfolio/attribution/:accountId/assets` — per-asset attribution
- [x] `GET /api/v1/portfolio/benchmarks` — list benchmarks
- [x] `POST /api/v1/portfolio/benchmarks` — create custom benchmark
- [x] `GET /api/v1/portfolio/benchmarks/:benchmarkId` — benchmark detail
- [x] `GET /api/v1/portfolio/benchmarks/:benchmarkId/snapshots` — benchmark price history
- [x] `POST /api/v1/portfolio/benchmarks/:benchmarkId/refresh` — refresh benchmark prices
- [x] `GET /api/v1/portfolio/diversification/:accountId` — diversification analysis
- [x] `GET /api/v1/portfolio/allocation/:accountId` — current allocation
- [x] `GET /api/v1/portfolio/allocation/:accountId/history` — allocation history
- [x] `GET /api/v1/portfolio/allocation/:accountId/drift` — drift from target
- [x] `GET /api/v1/portfolio/recommendations/:accountId` — active recommendations
- [x] `POST /api/v1/portfolio/recommendations/:accountId/generate` — trigger generation
- [x] `PATCH /api/v1/portfolio/recommendations/:accountId/:recId/dismiss` — dismiss recommendation
- [x] `GET /api/v1/portfolio/rankings` — portfolio rankings (by return, health, Sharpe)
- [x] `GET /api/v1/portfolio/rankings/leaders` — leaderboard view
- [x] `GET /api/v1/portfolio/audit-log` — analytics audit log
- [x] `GET /api/v1/portfolio/audit-log/:accountId` — per-account audit log

---

## Phase 8 — Execution Engine

> ⚠️ Real financial risk begins here. Do not start until Phase 6 is proven via Phase 5.

- [ ] Broker adapter interface
- [ ] First broker integration (TBD)
- [ ] Order routing layer
- [ ] Fill confirmation and reconciliation
- [ ] Kill switch

---

## Phase 9 — AI Research Assistant

- [ ] LLM integration (Replit AI)
- [ ] Strategy hypothesis generation
- [ ] Backtest result interpretation
- [ ] Market regime analysis

---

## Phase 10 — Production Readiness

- [ ] Full security audit
- [ ] Penetration testing checklist
- [ ] Comprehensive health monitoring
- [ ] Automated database backups with restore testing
- [ ] Incident response playbook

---

## Icebox (Future Consideration)

- [ ] Mobile app (read-only monitoring)
- [ ] Strategy marketplace (sharing configs, not signals)
- [ ] Options strategy support
- [ ] Futures roll management
- [ ] Tax lot tracking and reporting
- [ ] Multi-currency portfolio accounting
