# TODO.md — QuantForge Phased Roadmap

> Last updated: 2026-06-01
> Current phase: **Phase 4 — Professional Backtesting & Validation Engine** ✅ COMPLETE

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

## Phase 5 — Paper Trading

**Goal**: Real-time strategy execution simulation against live market data.

### Simulation Engine
- [ ] Virtual account management (balance, positions, P&L)
- [ ] Real-time order routing simulation
- [ ] Fill simulation against live market prices
- [ ] Position tracking and reconciliation

### Paper Trading API
- [ ] `POST /v1/paper/orders` — submit paper order
- [ ] `GET /v1/paper/orders` — list paper orders
- [ ] `GET /v1/paper/positions` — current positions
- [ ] `GET /v1/paper/account` — account summary

---

## Phase 6 — Risk Engine

**Goal**: Enforce position sizing, exposure limits, and drawdown controls before any order is executed.

### Pre-Trade Risk Checks
- [ ] Maximum position size (% of portfolio)
- [ ] Maximum single-asset exposure
- [ ] Drawdown circuit breaker

### Risk Engine API
- [ ] `POST /v1/risk/check` — pre-trade risk validation
- [ ] `GET /v1/risk/exposure` — current exposure report
- [ ] `GET /v1/risk/limits` — current risk limits

---

## Phase 7 — Portfolio Analytics

**Goal**: Comprehensive performance measurement and attribution.

### Performance Metrics
- [ ] Time-weighted return (TWR)
- [ ] Money-weighted return (MWR / IRR)
- [ ] Benchmark comparison (alpha, beta, information ratio)
- [ ] Attribution by strategy, asset class, and time period

### Analytics API
- [ ] `GET /v1/analytics/performance` — performance summary
- [ ] `GET /v1/analytics/attribution` — return attribution
- [ ] `GET /v1/analytics/trades` — trade journal

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
