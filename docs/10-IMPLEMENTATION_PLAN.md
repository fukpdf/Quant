# 10-IMPLEMENTATION_PLAN.md — Implementation Plan

> Status: Phase 0 outline — detailed implementation tasks maintained in TODO.md.

---

## Overview

This document describes the sequencing, dependencies, and delivery milestones for all phases of QuantForge. TODO.md contains the detailed task checklists; this document provides the "why this order" rationale.

---

## Phase Sequencing Rationale

The phases are ordered by dependency, not by desirability:

```
Phase 0 (Foundation)
  └── Required before anything else — operating rules, documentation system, AI agent protocols

Phase 1 (Market Data)
  └── Required before Phase 2 — cannot store data without ingesting it

Phase 2 (Historical Storage)
  └── Required before Phase 3, 4 — research and backtesting need data at scale

Phase 3 (Research Lab)
  └── Required before Phase 4 — indicators and strategy framework are used by the backtester

Phase 4 (Backtesting)
  └── Required before Phase 5 — validate strategy offline before running live

Phase 5 (Paper Trading)
  └── Required before Phase 6 — need live trading simulation to test risk engine

Phase 6 (Risk Engine)
  └── Required before Phase 8 — MANDATORY. No live trading without risk controls.

Phase 7 (Analytics)
  └── Parallel with Phase 5+ — can be built while paper trading accumulates data
  └── Required before Phase 8 — need performance visibility before going live

Phase 8 (Execution)
  └── Requires Phase 5, 6, 7 complete — the full stack must be validated

Phase 9 (AI Assistant)
  └── Can begin after Phase 3 — needs research infrastructure but not execution
  └── Not on critical path to live trading

Phase 10 (Production)
  └── Requires Phase 8 — hardening of a complete system
```

---

## Phase 0 — Repository Foundation

**Target completion**: Session 1

**Deliverables:**
- Complete documentation structure
- AI agent operating protocols
- Project rules and standards
- Directory skeleton
- GitHub templates

**Success criteria**: A new AI agent can understand the entire project within 5 minutes of opening the repository.

**Exit criteria**: All items in Phase 0 TODO checklist marked complete.

---

## Phase 1 — Market Data Platform

**Target completion**: 2–4 weeks after Phase 0

**Key decisions required:**
- Which crypto exchange to connect first (recommendation: Binance — largest volume, best API)
- Which forex provider (recommendation: evaluate Alpha Vantage vs. OANDA)
- Which stock data provider (recommendation: evaluate Polygon.io)

**Critical path:**
1. OpenAPI spec for data endpoints → codegen → frontend data views
2. Data adapter for first exchange (crypto)
3. Normalization layer
4. Database write pipeline (partial Phase 2 dependency)
5. Frontend feed status dashboard

**Risk:** Data provider API limits may restrict historical data access. Mitigation: select providers with adequate historical data in their plans.

---

## Phase 2 — Historical Data Storage

**Target completion**: 2–3 weeks after Phase 1

**Key decisions required:**
- TimescaleDB extension vs. native PostgreSQL partitioning for OHLCV storage
- Historical data backfill depth (1 year? 5 years? 10 years?)
- Data retention policy

**Critical path:**
1. Schema design and migration (ohlcv_data partitioning strategy)
2. Backfill pipeline for all connected providers
3. Data quality validation pipeline
4. Query performance benchmarks

**Risk:** Large backfill jobs may take hours and require careful rate limiting to avoid provider throttling.

---

## Phase 3 — Research Laboratory

**Target completion**: 3–4 weeks after Phase 2

**Key decisions required:**
- Python integration approach (subprocess? WASM? TypeScript-only?)
- Notebook environment (Jupyter integration vs. custom web UI)

**Critical path:**
1. Indicator library (TypeScript implementation)
2. Indicator validation against reference values
3. Research API endpoints
4. Strategy definition schema

**Risk:** Python integration is non-trivial in the Node.js monorepo. If Python adds too much complexity, evaluate a TypeScript-only approach first.

---

## Phase 4 — Backtesting Engine

**Target completion**: 4–6 weeks after Phase 3

**Key decisions required:**
- Backtesting execution model (in-process vs. worker threads vs. separate service)
- Walk-forward window configuration UI

**Critical path:**
1. Event-driven backtesting loop (no vectorized shortcuts)
2. Order simulation (market, limit, stop)
3. Fill and cost modeling
4. Performance metrics library
5. Walk-forward analysis framework

**Risk:** Performance. Backtesting 500 symbols × 10 years of minute data is compute-intensive. Worker threads will likely be required.

---

## Phase 5 — Paper Trading

**Target completion**: 2–3 weeks after Phase 4

**Critical path:**
1. Paper account state management (persistent across restarts)
2. Real-time order routing (against live market data from Phase 1)
3. Fill simulation
4. Position and P&L tracking

**Gate:** 30 days of paper trading on at least one strategy before Phase 8 begins.

---

## Phase 6 — Risk Engine

**Target completion**: 2–3 weeks after Phase 5

**Critical path:**
1. Pre-trade check framework (all checks, documented rejection codes)
2. Position sizing calculator
3. Exposure monitoring (real-time)
4. Circuit breaker implementation
5. Risk configuration API

**This phase is a hard gate for Phase 8. Do not bypass.**

---

## Phase 7 — Portfolio Analytics

**Target completion**: 3–4 weeks, can run in parallel with Phase 5 and 6

**Critical path:**
1. TWR and MWR calculation
2. Attribution engine (by strategy, asset class, period)
3. Benchmark comparison
4. Performance dashboard (frontend)
5. Trade journal export

---

## Phase 8 — Execution Engine

**Prerequisites (all must be complete and proven):**
- Phase 5: Paper trading validated for 30+ days
- Phase 6: Risk engine battle-tested in paper trading
- Phase 7: Analytics in place to monitor live performance

**Target completion**: 4–6 weeks after all prerequisites

**Critical path:**
1. Broker adapter interface definition
2. First broker integration
3. Order routing with risk check integration
4. Kill switch implementation
5. Live reconciliation against broker statements

---

## Phase 9 — AI Research Assistant

**Target completion**: Can begin after Phase 3, run in parallel

**Critical path:**
1. LLM integration (via Replit AI Integrations)
2. Hypothesis generation prompts
3. Backtest result interpretation
4. Natural language strategy description → indicator mapping

---

## Phase 10 — Production Readiness

**Target completion**: 4–6 weeks after Phase 8 is stable

**Critical path:**
1. Security audit (OWASP checklist)
2. Dependency audit
3. Monitoring and alerting infrastructure
4. Backup and restore testing
5. Runbook and incident response documentation
6. Performance load testing

---

## Milestone Summary

| Milestone | Phase Completion | Key Outcome |
|-----------|-----------------|-------------|
| M0 | Phase 0 | Repository is agent-readable and self-documenting |
| M1 | Phase 1 | Live market data flowing for all asset classes |
| M2 | Phase 2 | Years of historical data stored and queryable |
| M3 | Phase 3 | First strategy defined and testable |
| M4 | Phase 4 | First strategy fully backtested with walk-forward |
| M5 | Phase 5 | Strategy running in paper trading |
| M6 | Phase 6 | Risk engine enforcing all limits in paper trading |
| M7 | Phase 7 | Full performance analytics in place |
| M8 | Phase 8 | First live trade executed with full audit trail |
| M9 | Phase 9 | AI assistant generating testable hypotheses |
| M10 | Phase 10 | Platform hardened and production-ready |

---

## Technology Introduction Timeline

| Technology | Phase Introduced | Reason |
|-----------|-----------------|--------|
| PostgreSQL | Phase 0 (provisioned) / Phase 2 (used at scale) | Core data store |
| React + Vite frontend | Phase 1 | Data monitoring UI |
| TimescaleDB (maybe) | Phase 2 | Decision pending benchmarks |
| Worker Threads | Phase 4 | Backtest performance |
| Python (maybe) | Phase 3 | Research notebooks (decision pending) |
| LLM API | Phase 9 | AI assistant |
| Redis (maybe) | Phase 6+ | Real-time position caching, pub/sub for events |
