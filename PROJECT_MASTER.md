# PROJECT_MASTER.md — QuantForge Project Brain

> This is the authoritative project reference. All AI agents and contributors must read this before making any changes.

---

## 1. Vision

QuantForge is a personal quantitative trading platform that brings institutional-grade discipline to individual systematic trading. It is not a copy-trading tool, a signal service, or a get-rich-quick scheme. It is a rigorous research and execution environment built by a single operator who demands the same standards from their own trading infrastructure as they would from a professional quant desk.

The platform covers the full lifecycle:

```
Market Data → Research → Strategy Development → Backtesting → Paper Trading → Risk Control → Live Execution
```

Every stage is audited, versioned, and documented.

---

## 2. Long-Term Goals

- **Data sovereignty**: Own all market data. No vendor lock-in on historical data.
- **Research rigor**: All strategies must pass walk-forward validation, not just in-sample backtest.
- **Risk-first culture**: No position is ever entered without explicit risk approval from the risk engine.
- **Full audit trail**: Every order, every signal, every parameter change is logged and queryable.
- **AI-augmented research**: AI assists hypothesis generation and code review; AI does not make autonomous trading decisions.
- **Multi-asset capability**: Operate across crypto, forex, equities, indices, and commodities from a single unified platform.
- **Modular and replaceable**: Every component (data provider, broker, risk model) can be swapped without rewriting the platform.

---

## 3. Scope

### In Scope

- Real-time and historical market data ingestion
- OHLCV, tick data, order book snapshots
- Strategy definition in code (Python/TypeScript)
- Event-driven backtesting engine
- Paper trading simulation engine
- Position sizing and risk management engine
- Portfolio performance analytics
- Trade journal and audit logs
- AI research assistant (hypothesis generation, not autonomous trading)
- Multi-asset class support: Crypto, Forex, Stocks, Indices, Commodities
- Web-based dashboard for monitoring and research

### Out of Scope (Forever)

- Automated live trading without manual approval
- Social trading or signal sharing
- Managing third-party funds
- Guaranteed returns or performance claims

### Out of Scope (This Phase)

- Live order execution
- Real-time streaming UI
- Strategy marketplace
- Mobile application

---

## 4. Non-Goals

- This is NOT a trading bot that runs autonomously without oversight
- This is NOT a social platform
- This is NOT a SaaS product
- This is NOT a replacement for professional financial advice
- This is NOT designed for high-frequency trading (sub-millisecond)

---

## 5. Current Phase

**Phase 6 — Institutional Risk Engine & Capital Protection Layer** ✅ Complete

Goal: Enforce position sizing, exposure limits, and drawdown circuit breakers before any order is executed. The central pre-trade gatekeeper of the platform.

Deliverables:
- [x] 12 new DB tables: risk_profiles, risk_rules, risk_decisions, risk_events, risk_violations, portfolio_risk_snapshots, strategy_risk_scores, correlation_matrices, drawdown_events, circuit_breaker_events, kill_switch_events, risk_audit_log
- [x] Pre-trade risk engine: 13 sequential checks (kill switch → circuit breakers → account → position size → exposure → daily loss → drawdown → concentration → open positions → strategy confidence → data freshness)
- [x] Risk profile system: 4 seeded default profiles (Conservative/Balanced/Aggressive/Research) + custom via API
- [x] Kill switch: in-memory scoped halt (trading/account/strategy/portfolio/scheduler) with immutable audit trail
- [x] Circuit breakers: 6 types (loss streak, drawdown, execution failure, volatility, data failure, market closure)
- [x] Correlation engine: Pearson matrix computation from daily OHLCV with configurable rolling window
- [x] Strategy risk scorer: 9-component scoring (win rate, drawdown, Sharpe, consistency, frequency, exposure, overall, health, confidence)
- [x] Drawdown monitor: multi-horizon monitoring (daily/weekly/account) with warning/restriction/halt tiers
- [x] Risk scheduler: 5 independent polling loops (snapshots 10min, correlation 6h, scoring 1h, exposure 5min, circuit breakers 2min)
- [x] Risk API: 20 endpoints (profiles CRUD, decisions, events, violations, snapshots, correlations, strategies, circuit breakers, kill switch, audit log)
- [x] Paper trading integration: every BUY/SELL passes through evaluateOrder() before execution
- [x] OpenAPI spec 0.6.0: `risk` tag + 20 path entries + 30+ schemas; codegen regenerated

**Current Phase:**

**Phase 10 — Institutional Execution Engine** ✅ Complete
- 12 DB tables, IExecutionProvider abstraction (Mock/Paper/live_disabled, env-driven), four-stage pre-trade pipeline (validation → risk → kill-switch → circuit-breaker, ADR-027), strict order state machine with illegal-transition enforcement (ADR-026), MockProvider (instant-fill, ±5bps slippage), PaperProvider (Phase 9 MarketStateEngine pricing), mode-aware router (ADR-028), fill engine with slippage/commission tracking (ADR-029), position engine with avg-cost basis and MTM (ADR-030), stale/stuck order monitor (ADR-031), 5-min analytics engine fill rate/p95 latency (ADR-032), recovery service lost-ACK/fill detection (ADR-033), 5 route files, 13 endpoints, OpenAPI 0.10.0 with `execution` tag, codegen regenerated. **SAFE MODE ONLY — `live` is not a valid EXECUTION_MODE; all orders route to mock or paper.**

**Prior Phases Complete:**

**Phase 9 — Real-Time Market Streaming & Event Infrastructure** ✅ Complete
- 12 DB tables, IStreamProvider abstraction (Mock/Binance/stubs, env-driven), in-memory EventEmitter event bus with DB audit (ADR-020), MarketStateEngine with VWAP/momentum/volatility (ADR-022), StreamConnectionManager with exponential backoff reconnect, TickProcessor (batched), OrderBookProcessor (sampled), StreamMetricsProcessor (rolling p95/p99), ReplayEngine 1x-100x (ADR-023), StreamRecoveryService with gap detection + OHLCV backfill (ADR-024), StreamHealthEngine composite score 0-100, 5 route files, 15 endpoints, OpenAPI 0.9.0 with `streams` tag, codegen regenerated

**Phase 8 — AI Research Assistant & Quant Intelligence Layer** ✅ Complete
- 10 DB tables, LLM provider abstraction (OpenAI/Anthropic/Gemini/Mock, env-driven), AI context engine (reads all platform domains), chat service (conversation threading), report engine (12 types), analysis service (strategy/portfolio/risk/comparison/insights), 8 route files, 19 endpoints, immutable audit log, advisory-only safety boundary enforced architecturally, OpenAPI 0.8.0 with `ai` tag, codegen regenerated

**Phase 6 — Institutional Risk Engine & Capital Protection Layer** ✅ Complete
- 8 DB tables, pre-trade risk engine (5 checks), position sizing enforcement, drawdown monitoring, circuit breakers, kill switch (in-memory), correlation matrix, risk scheduler (5 loops), risk API (25 endpoints)

**Phase 5 — Institutional Paper Trading Environment** ✅ Complete
- 10 DB tables, execution engine (slippage/commission/jitter), position manager, portfolio tracker, performance service, alert manager, snapshot service, signal engine, paper scheduler (4 loops), paper API (15 endpoints)

**Phase 4 — Professional Backtesting & Validation Engine** ✅ Complete
- Cost modeling (commission + slippage, 5 exchange presets), position sizing (5 methods including Kelly), advanced metrics (Calmar, Ulcer, MAR, UPI), portfolio engine, walk-forward, Monte Carlo, validation (A–F grading), equity curves, rankings

**Phase 3 — Research Laboratory** ✅ Complete
- Strategy framework (IStrategy, BaseStrategy), 4 strategies, backtesting engine (no look-ahead bias), performance metrics (Sharpe, Sortino, Expectancy), research API (6 endpoints)

**Next Phase: Phase 11 — Production Readiness**

Goal: Security audit, AI rate limiting enforcement, alerting infrastructure, database backup automation, performance profiling, and deployment pipeline.

---

## 6. Future Phases

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Market Data Platform | Data ingestion connectors, normalization, real-time feeds |
| 2 | Historical Data Storage | TimescaleDB or Postgres partitioned storage, data quality checks |
| 3 | Research Laboratory | Jupyter-style research environment, indicator library |
| 4 | Backtesting Engine | Event-driven backtester, slippage models, transaction cost models |
| 5 | Paper Trading | Order simulation, fill modeling, account state tracking |
| 6 | Risk Engine | Position sizing, drawdown limits, exposure controls, circuit breakers |
| 7 | Portfolio Analytics | Performance attribution, risk-adjusted metrics, reporting |
| 8 | AI Research Assistant | LLM advisory layer — advisory chat, reports, insights, comparisons ✅ |
| 9 | Execution Engine | Live broker connectivity, order management, reconciliation |
| 10 | Production Readiness | Hardening, monitoring, alerting, DR, security audit |

---

## 7. Architecture Overview

### Guiding Principles

1. **API-first**: All services communicate via well-defined OpenAPI contracts.
2. **Event-driven core**: Market data, signals, orders, and fills flow through an event bus.
3. **Immutable logs**: Nothing is ever deleted from the audit log.
4. **Separation of concerns**: Data, research, risk, and execution are fully decoupled modules.
5. **Contract-first development**: OpenAPI spec is written before any implementation code.

### High-Level Components

```
┌─────────────────────────────────────────────┐
│                   Frontend                   │
│         React + Vite Dashboard               │
└──────────────────┬──────────────────────────┘
                   │ REST / WebSocket
┌──────────────────▼──────────────────────────┐
│                 API Gateway                  │
│           Express 5 + OpenAPI               │
└──┬──────────────┬──────────────┬────────────┘
   │              │              │
   ▼              ▼              ▼
Market Data    Research       Risk Engine
 Service        Engine         Service
   │              │              │
   └──────────────▼──────────────┘
              PostgreSQL
           (Primary Database)
```

### Technology Choices

| Concern | Technology | Rationale |
|---------|-----------|-----------|
| Primary DB | PostgreSQL | Reliable, well-understood, supports time-series via partitioning |
| ORM | Drizzle | Type-safe, lightweight, pairs well with Zod |
| Validation | Zod v4 | Runtime + compile-time safety |
| API contract | OpenAPI 3.1 | Industry standard, enables client codegen |
| Frontend | React + Vite | Fast iteration, strong ecosystem |
| Package manager | pnpm workspaces | Monorepo support, speed |

---

## 8. Security Principles

1. **Zero secrets in code**: Every credential lives in environment variables or a secrets manager.
2. **Least privilege by default**: Services only access what they need.
3. **Audit everything**: All sensitive operations are logged with actor, timestamp, and payload.
4. **Defense in depth**: Never rely on a single security control.
5. **No real money exposure until Phase 8**: Paper trading and backtesting carry no financial risk.
6. **API keys rotated regularly**: Exchange and data provider keys are treated as ephemeral.
7. **Encryption in transit and at rest**: All network traffic uses TLS; sensitive DB columns are encrypted.

See [SECURITY.md](./SECURITY.md) and [docs/06-SECURITY_ARCHITECTURE.md](./docs/06-SECURITY_ARCHITECTURE.md) for detail.

---

## 9. Development Principles

1. **Documentation first**: No feature ships without documentation.
2. **Small, focused commits**: Each commit does exactly one thing.
3. **Changelog discipline**: Every meaningful change gets a CHANGELOG entry.
4. **Architecture decisions are recorded**: Every non-obvious architectural choice goes in DECISIONS.md.
5. **Test before ship**: No code merges to main without passing tests.
6. **Schema migrations are reversible**: Every migration must have a down path.
7. **No breaking API changes without versioning**: The API contract is a promise.
8. **AI agents follow AGENTS.md**: Any AI writing code for this project must read and follow AGENTS.md.

---

## 10. Deployment Principles

1. **Dev → Staging → Production**: No direct pushes to production.
2. **Environment parity**: Dev and staging environments mirror production configuration.
3. **Immutable deploys**: Each deployment is tagged and can be rolled back.
4. **Secrets never in build artifacts**: Build pipelines never embed secrets in compiled output.
5. **Health checks on every service**: No deployment completes without a passing health endpoint.
6. **Database migrations run before app startup**: Migration-then-start, not the reverse.

---

## 11. Project Constraints

- **Single operator**: This is a personal project. No multi-tenancy, no user management (yet).
- **Replit as development environment**: The primary dev environment is Replit.
- **Node.js / TypeScript ecosystem**: The platform is TypeScript-native. Python may be introduced for research (Phase 3+).
- **PostgreSQL only**: No polyglot persistence in early phases. One database, mastered well.
- **No real money before Phase 9**: Execution against real capital does not begin until the risk engine (Phase 6) is proven through paper trading (Phase 5).

---

## 12. Risk Management Principles

These apply to the project itself (not trading risk, which is in docs/07):

- **Vendor risk**: Avoid vendor lock-in. Every external dependency has a documented replacement path.
- **Data loss risk**: Database backups are mandatory from Phase 2 onwards.
- **Runaway cost risk**: All cloud resource usage has hard spending caps.
- **Complexity risk**: No feature is added without a clear problem it solves. Avoid speculative complexity.
- **Security breach risk**: No API keys are ever committed to git. Secrets rotate on any suspected exposure.
