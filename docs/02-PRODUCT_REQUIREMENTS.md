# 02-PRODUCT_REQUIREMENTS.md — Product Requirements

> Status: Phase 0 outline — detailed requirements populated as each phase begins.

---

## Overview

This document defines what the platform must do from the user's perspective. It describes capabilities, not implementation. Technical implementation details belong in docs/03-TECHNICAL_REQUIREMENTS.md and docs/04-SYSTEM_ARCHITECTURE.md.

---

## Phase 1 — Market Data Platform

### PRD-101: Asset Coverage
**As a** quantitative researcher,
**I want** to access real-time and historical OHLCV data for crypto, forex, stocks, indices, and commodities,
**so that** I can research strategies across multiple asset classes without switching between tools.

**Acceptance Criteria:**
- [ ] At least 1 crypto exchange connected (e.g., Binance)
- [ ] At least 1 forex provider connected
- [ ] At least 1 stock/index data provider connected
- [ ] Data normalized to a unified OHLCV schema regardless of source
- [ ] Data quality report available per asset (gap count, last updated)

### PRD-102: Data Feed Health
**As a** platform operator,
**I want** to monitor the health of all data feeds from a single dashboard,
**so that** I can detect and respond to data outages before they affect strategy decisions.

**Acceptance Criteria:**
- [ ] Feed status visible per provider (connected, degraded, disconnected)
- [ ] Last received timestamp visible per asset
- [ ] Automatic reconnection on disconnect
- [ ] Alert generated on feed outage > 5 minutes

---

## Phase 2 — Historical Data Storage

### PRD-201: Historical Data Access
**As a** quantitative researcher,
**I want** to query historical OHLCV data by symbol, timeframe, and date range,
**so that** I can build research datasets and run backtests.

**Acceptance Criteria:**
- [ ] Query returns data for any symbol in storage
- [ ] Supported timeframes: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
- [ ] Date range filtering with start and end timestamps
- [ ] Response time < 2 seconds for 1 year of daily data
- [ ] Data completeness report per symbol

### PRD-202: Data Quality Controls
**As a** quantitative researcher,
**I want** to know the quality of the data I am using,
**so that** I do not build strategies on corrupted or incomplete datasets.

**Acceptance Criteria:**
- [ ] Gap detection runs automatically after data ingestion
- [ ] Outlier detection flags suspicious price spikes (configurable threshold)
- [ ] Data quality report shows: total bars, gaps, outliers, coverage percentage
- [ ] Gaps are backfilled from secondary sources where available

---

## Phase 3 — Research Laboratory

### PRD-301: Indicator Library
**As a** quantitative researcher,
**I want** access to a library of standard technical indicators,
**so that** I can build and test strategy signals without reimplementing common calculations.

**Acceptance Criteria:**
- [ ] At minimum: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, ADX, VWAP, OBV
- [ ] Each indicator has documented parameters and expected inputs/outputs
- [ ] Indicator outputs match reference implementation values (testable against known datasets)
- [ ] Indicators can be chained (output of one as input to another)

### PRD-302: Research Notebook Integration
**As a** quantitative researcher,
**I want** to interact with market data and indicators in an exploratory notebook environment,
**so that** I can iterate on strategy ideas quickly without writing full application code.

**Acceptance Criteria:**
- [ ] Access to all stored historical data from within notebooks
- [ ] Indicator library available in notebooks
- [ ] Charts render inline
- [ ] Notebooks are version-controlled alongside strategy code

---

## Phase 4 — Backtesting Engine

### PRD-401: Strategy Backtesting
**As a** strategy developer,
**I want** to run a backtest of a strategy against historical data with realistic cost modeling,
**so that** I can evaluate strategy performance before committing any capital.

**Acceptance Criteria:**
- [ ] Event-driven execution (not vectorized) to prevent look-ahead bias
- [ ] Configurable commission model (flat, percentage, per-share)
- [ ] Configurable slippage model (fixed, percentage, volume-based)
- [ ] Configurable spread model
- [ ] Reproducible: same inputs always produce identical outputs
- [ ] Results include: total return, Sharpe, Sortino, max drawdown, win rate, profit factor

### PRD-402: Walk-Forward Validation
**As a** strategy developer,
**I want** to validate a strategy using walk-forward analysis,
**so that** I can distinguish robust strategies from curve-fitted ones.

**Acceptance Criteria:**
- [ ] Configurable in-sample and out-of-sample window sizes
- [ ] Walk-forward report shows performance across all windows
- [ ] Degradation analysis (in-sample vs. out-of-sample performance gap)
- [ ] Monte Carlo simulation for result robustness testing

---

## Phase 5 — Paper Trading

### PRD-501: Paper Order Execution
**As a** strategy developer,
**I want** to run a strategy in paper trading mode against live market data,
**so that** I can validate real-time behavior before risking capital.

**Acceptance Criteria:**
- [ ] Paper orders execute against real-time bid/ask data
- [ ] Fill simulation accounts for spread and configured slippage
- [ ] Order types supported: market, limit, stop
- [ ] Partial fills handled correctly
- [ ] Paper account state is persistent (survives restarts)

---

## Phase 6 — Risk Engine

### PRD-601: Pre-Trade Risk Validation
**As a** platform operator,
**I want** every order (paper or live) to pass risk checks before execution,
**so that** no single trade or strategy can expose the portfolio to unacceptable risk.

**Acceptance Criteria:**
- [ ] Maximum position size check (% of portfolio)
- [ ] Maximum asset-class exposure check
- [ ] Correlation-adjusted exposure check
- [ ] Drawdown circuit breaker (configurable threshold)
- [ ] Risk check failure produces a clear, logged rejection reason
- [ ] No order bypasses risk checks — there is no override without explicit audit log entry

---

## Phase 7 — Portfolio Analytics

### PRD-701: Performance Dashboard
**As a** portfolio operator,
**I want** to see comprehensive performance metrics for my portfolio and individual strategies,
**so that** I can make informed decisions about strategy allocation.

**Acceptance Criteria:**
- [ ] Time-weighted return (TWR) and money-weighted return (MWR)
- [ ] Drawdown chart with peak, trough, and recovery durations
- [ ] Attribution: return by strategy, by asset class, by time period
- [ ] Benchmark comparison (configurable: SPY, BTC, custom)
- [ ] Export to CSV for external analysis or tax reporting

---

## Phase 8 — Execution Engine

### PRD-801: Live Order Execution
**As a** strategy operator,
**I want** to route approved signals to a live broker,
**so that** validated strategies can be executed with real capital.

**Acceptance Criteria:**
- [ ] Kill switch halts all live trading immediately
- [ ] Every live order has a complete audit trail
- [ ] Order fill confirmation reconciled against broker statements
- [ ] No order is placed without passing risk engine pre-trade checks
- [ ] Human approval required before any strategy goes live

---

## Phase 9 — AI Research Assistant

### PRD-901: Hypothesis Generation
**As a** quantitative researcher,
**I want** an AI assistant to help me generate and evaluate strategy hypotheses,
**so that** I can explore a wider idea space than I could manually.

**Acceptance Criteria:**
- [ ] AI can describe a market hypothesis in natural language
- [ ] AI can suggest indicator combinations to test the hypothesis
- [ ] AI can review backtest results and flag potential data snooping risks
- [ ] AI does NOT submit orders, modify risk limits, or make autonomous decisions

---

## Non-Functional Requirements

### Performance
- API response time (p95): < 500ms for all read endpoints
- Historical data query (1 year daily): < 2 seconds
- Backtest throughput: > 100,000 bars/second

### Reliability
- Data feed uptime: > 99.5%
- API uptime: > 99.9% (Phase 10+)
- Zero data loss for historical storage

### Security
- No secrets in code or git history (all phases)
- All API endpoints authenticated (Phase 8+)
- Full audit log for all financial operations (Phase 5+)

### Observability
- All errors logged with full context
- Health endpoints on all services
- Alerting on feed outages and risk limit approaches (Phase 6+)
