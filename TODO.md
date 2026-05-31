# TODO.md — QuantForge Phased Roadmap

> Last updated: 2026-05-31
> Current phase: **Phase 0 — Repository Foundation**

---

## Phase 0 — Repository Foundation

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

## Phase 1 — Market Data Platform

**Goal**: Establish reliable, normalized market data ingestion across all asset classes.

### Data Provider Integrations
- [ ] Research and select crypto data provider (e.g., CoinGecko, Binance, CCXT)
- [ ] Research and select forex data provider (e.g., Alpha Vantage, OANDA)
- [ ] Research and select stocks/indices data provider (e.g., Polygon.io, Yahoo Finance)
- [ ] Document provider selection in DECISIONS.md

### Data Ingestion
- [ ] Design data ingestion architecture
- [ ] Implement WebSocket connection manager for real-time feeds
- [ ] Implement REST polling fallback for providers without WebSocket
- [ ] Implement connection health monitoring and reconnection logic

### Data Normalization
- [ ] Define unified OHLCV schema across all asset classes
- [ ] Implement normalization layer (provider format → unified format)
- [ ] Define tick data schema
- [ ] Implement data quality validation (gap detection, outlier detection)

### API Endpoints (Phase 1)
- [ ] `GET /api/v1/assets` — list available assets
- [ ] `GET /api/v1/assets/:symbol/ohlcv` — fetch OHLCV data
- [ ] `GET /api/v1/assets/:symbol/quote` — fetch latest quote
- [ ] `GET /api/v1/feeds/status` — data feed health status

### Testing
- [ ] Unit tests for normalization layer
- [ ] Integration tests for data provider connections
- [ ] Data quality validation tests

### Documentation
- [ ] Update docs/04-SYSTEM_ARCHITECTURE.md with data flow diagrams
- [ ] Document all API endpoints in docs/09-API_STRATEGY.md
- [ ] Update docs/02-PRODUCT_REQUIREMENTS.md

---

## Phase 2 — Historical Data Storage

**Goal**: Efficient storage and retrieval of large volumes of time-series market data.

### Database Setup
- [ ] Provision PostgreSQL database
- [ ] Configure TimescaleDB extension (or implement manual partitioning strategy)
- [ ] Document partitioning decision in DECISIONS.md
- [ ] Set up automated backup strategy

### Schema Design
- [ ] Design `ohlcv_data` table (partitioned by time and asset class)
- [ ] Design `tick_data` table
- [ ] Design `assets` catalog table
- [ ] Design `data_providers` table
- [ ] Design `data_quality_log` table
- [ ] Create all Drizzle schema files
- [ ] Write and test migrations

### Data Pipeline
- [ ] Implement historical data backfill scripts
- [ ] Implement data quality checks (completeness, consistency)
- [ ] Implement data gap detection and alerting
- [ ] Implement data retention policies

### Query Performance
- [ ] Implement efficient OHLCV query patterns
- [ ] Add appropriate indexes with documented rationale
- [ ] Benchmark query performance at scale (1M+ rows)

### Documentation
- [ ] Complete docs/05-DATABASE_ARCHITECTURE.md
- [ ] Document backup and recovery procedures

---

## Phase 3 — Research Laboratory

**Goal**: Provide an interactive research environment for strategy development.

### Research Infrastructure
- [ ] Evaluate Python integration options (API, subprocess, embedded)
- [ ] Document approach in DECISIONS.md
- [ ] Set up research notebook infrastructure

### Indicator Library
- [ ] Implement core technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands, ATR)
- [ ] Implement volume indicators
- [ ] Implement volatility indicators
- [ ] Unit test all indicators against reference implementations

### Research API
- [ ] `GET /api/v1/research/indicators` — list available indicators
- [ ] `POST /api/v1/research/compute` — compute indicator on dataset
- [ ] `POST /api/v1/research/correlations` — compute correlation matrix

### Strategy Definition Framework
- [ ] Define strategy interface/contract
- [ ] Implement strategy configuration schema
- [ ] Implement strategy validation

### Documentation
- [ ] Complete docs/08-TRADING_RESEARCH.md
- [ ] Document indicator library

---

## Phase 4 — Backtesting Engine

**Goal**: Rigorous, realistic event-driven backtesting with proper cost modeling.

### Engine Architecture
- [ ] Design event-driven backtesting loop
- [ ] Implement order book simulation
- [ ] Implement fill modeling (market, limit, stop orders)

### Cost Modeling
- [ ] Implement configurable commission models (flat, percentage, per-share)
- [ ] Implement slippage models (fixed, variable, volume-based)
- [ ] Implement financing cost model for overnight positions

### Execution Simulation
- [ ] Implement market order simulation
- [ ] Implement limit order simulation with queue position
- [ ] Implement stop order simulation
- [ ] Implement order rejection scenarios

### Performance Metrics
- [ ] Implement Sharpe ratio, Sortino ratio, Calmar ratio
- [ ] Implement maximum drawdown analysis
- [ ] Implement win rate, profit factor, expectancy
- [ ] Implement trade-level attribution

### Walk-Forward Validation
- [ ] Implement in-sample / out-of-sample split
- [ ] Implement walk-forward optimization framework
- [ ] Implement Monte Carlo simulation for result robustness

### Documentation
- [ ] Document backtesting methodology
- [ ] Document cost model assumptions

---

## Phase 5 — Paper Trading

**Goal**: Real-time strategy execution simulation against live market data.

### Simulation Engine
- [ ] Implement virtual account management (balance, positions, P&L)
- [ ] Implement real-time order routing simulation
- [ ] Implement fill simulation against live market prices
- [ ] Implement position tracking and reconciliation

### Order Management
- [ ] Implement order lifecycle management (pending, open, filled, cancelled, rejected)
- [ ] Implement partial fill handling
- [ ] Implement order modification and cancellation

### Paper Trading API
- [ ] `POST /api/v1/paper/orders` — submit paper order
- [ ] `GET /api/v1/paper/orders` — list paper orders
- [ ] `GET /api/v1/paper/positions` — current positions
- [ ] `GET /api/v1/paper/account` — account summary

### Documentation
- [ ] Document paper trading limitations vs. live trading

---

## Phase 6 — Risk Engine

**Goal**: Enforce position sizing, exposure limits, and drawdown controls before any order is executed.

### Pre-Trade Risk Checks
- [ ] Maximum position size (% of portfolio)
- [ ] Maximum single-asset exposure
- [ ] Maximum sector/asset-class exposure
- [ ] Correlation-adjusted position sizing
- [ ] Drawdown circuit breaker (halt trading at threshold)

### Post-Trade Monitoring
- [ ] Real-time P&L monitoring
- [ ] Drawdown tracking per strategy and portfolio
- [ ] Exposure aggregation across all positions
- [ ] Alert system for approaching risk limits

### Risk Engine API
- [ ] `POST /api/v1/risk/check` — pre-trade risk validation
- [ ] `GET /api/v1/risk/exposure` — current exposure report
- [ ] `GET /api/v1/risk/limits` — current risk limits

### Documentation
- [ ] Complete docs/07-RISK_MANAGEMENT.md

---

## Phase 7 — Portfolio Analytics

**Goal**: Comprehensive performance measurement and attribution.

### Performance Metrics
- [ ] Implement time-weighted return (TWR)
- [ ] Implement money-weighted return (MWR / IRR)
- [ ] Implement benchmark comparison (alpha, beta, information ratio)
- [ ] Implement attribution by strategy, asset class, and time period

### Reporting
- [ ] Daily portfolio summary
- [ ] Monthly performance report
- [ ] Drawdown analysis report
- [ ] Trade journal export (CSV)

### Analytics API
- [ ] `GET /api/v1/analytics/performance` — performance summary
- [ ] `GET /api/v1/analytics/attribution` — return attribution
- [ ] `GET /api/v1/analytics/trades` — trade journal

---

## Phase 8 — Execution Engine

**Goal**: Live broker connectivity with full order management and reconciliation.

> ⚠️ This phase introduces real financial risk. Do not begin until Phase 6 (Risk Engine) is fully proven through Phase 5 (Paper Trading).

### Broker Connectivity
- [ ] Define broker adapter interface
- [ ] Implement first broker adapter (TBD)
- [ ] Implement order routing layer
- [ ] Implement fill confirmation and reconciliation

### Order Management System
- [ ] Implement production order lifecycle
- [ ] Implement order audit log
- [ ] Implement fill reconciliation against broker statements

### Safety Controls
- [ ] Kill switch (halt all trading immediately)
- [ ] Position limit enforcement (hard stops, not just soft alerts)
- [ ] Anomalous activity detection

---

## Phase 9 — AI Research Assistant

**Goal**: LLM-powered research assistant for hypothesis generation and analysis.

> AI assists research. AI does not make autonomous trading decisions.

### Research Assistance
- [ ] Integrate LLM API (via Replit AI Integrations)
- [ ] Implement strategy hypothesis generation
- [ ] Implement backtest result interpretation
- [ ] Implement market regime analysis

### Code Assistance
- [ ] Implement indicator code generation
- [ ] Implement strategy code review

---

## Phase 10 — Production Readiness

**Goal**: Harden the platform for reliable long-term operation.

### Security
- [ ] Full security audit
- [ ] Penetration testing checklist
- [ ] Dependency vulnerability audit
- [ ] Secret rotation procedures

### Reliability
- [ ] Implement comprehensive health monitoring
- [ ] Implement alerting (PagerDuty or similar)
- [ ] Implement automated database backups with restore testing
- [ ] Implement disaster recovery procedures

### Operations
- [ ] Runbook for common operational tasks
- [ ] Incident response playbook
- [ ] Performance benchmarks and SLOs

---

## Icebox (Future Consideration)

- [ ] Mobile app (read-only monitoring)
- [ ] Strategy marketplace (sharing configs, not signals)
- [ ] Options strategy support
- [ ] Futures roll management
- [ ] Tax lot tracking and reporting
- [ ] Multi-currency portfolio accounting
