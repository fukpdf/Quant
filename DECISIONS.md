# DECISIONS.md — Architecture Decision Records

> This file records all significant architectural and design decisions made during the project.
> Every non-obvious decision must have a record here.
> Closed decisions should not be re-litigated without strong justification.

---

## Record Format

```
### ADR-NNN — Decision Title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded by ADR-NNN
**Author**: [human or AI agent identifier]

**Decision**
What was decided.

**Context**
What problem was being solved. Why was a decision needed.

**Rationale**
Why this option was chosen over alternatives.

**Alternatives Considered**
- Option A — why rejected
- Option B — why rejected

**Consequences**
What becomes easier and what becomes harder as a result of this decision.

**Review Trigger**
What conditions would cause this decision to be reconsidered.
```

---

## Decisions

---

### ADR-001 — GitHub as Source Control

**Date**: 2026-05-31
**Status**: Accepted
**Author**: Project founder

**Decision**
Use GitHub as the primary source control and collaboration platform.

**Context**
The project requires version control, history, and a pathway to CI/CD. A platform choice was needed at the outset.

**Rationale**
GitHub is the industry standard for open-source and private development. It has the best integration ecosystem (Actions, Dependabot, CodeQL, etc.), the widest AI tooling support (GitHub Copilot, Claude, etc.), and the most familiar interface for future collaborators.

**Alternatives Considered**
- GitLab — strong CI/CD but less ecosystem breadth; not required here
- Bitbucket — strong Jira integration but weaker AI tooling support
- Self-hosted Gitea — maximum control but operational overhead not justified for personal project

**Consequences**
- Repository history, issues, and pull requests are hosted on GitHub's infrastructure
- GitHub Actions will be used for CI/CD in Phase 10
- GitHub Secrets will be used for CI/CD credentials

**Review Trigger**
GitHub changes terms of service in a way that conflicts with project requirements, or pricing becomes prohibitive.

---

### ADR-002 — Replit as Development Environment

**Date**: 2026-05-31
**Status**: Accepted
**Author**: Project founder

**Decision**
Use Replit as the primary development and hosting environment for personal development.

**Context**
A cloud-based development environment was needed that supports Node.js, TypeScript, PostgreSQL, and long-running server processes.

**Rationale**
Replit provides an integrated environment with secrets management, PostgreSQL provisioning, workflow management, AI agent integration, and instant preview URLs. It eliminates local environment setup and enables development from any device.

**Alternatives Considered**
- Local development (laptop) — requires manual setup, not accessible from all devices
- GitHub Codespaces — good integration but higher cost for always-on workloads
- Railway + local IDE — clean hosting but requires separate IDE setup

**Consequences**
- All development happens in Replit
- Secrets are managed via Replit Secrets panel
- Deployments use Replit's deployment infrastructure
- Port and path conventions follow Replit's proxy model (paths not rewritten)

**Review Trigger**
Replit changes pricing, removes features used by this project, or performance becomes inadequate for backtesting workloads.

---

### ADR-003 — PostgreSQL as Primary Database

**Date**: 2026-05-31
**Status**: Accepted
**Author**: Project founder

**Decision**
Use PostgreSQL as the single primary database for all application data, including time-series market data.

**Context**
The platform will store multiple categories of data: market data (OHLCV, ticks), trade records, strategy configurations, risk parameters, and analytics. A database technology choice was needed.

**Rationale**
PostgreSQL is mature, reliable, and well-understood. It handles both relational data (strategies, configurations) and time-series data (via partitioning or TimescaleDB extension) in a single system. Drizzle ORM provides type-safe access. The team (single developer) has deep PostgreSQL experience.

**Alternatives Considered**
- TimescaleDB (standalone) — excellent for time-series but adds operational complexity
- InfluxDB — purpose-built for time-series but no relational capability; forces polyglot persistence
- MongoDB — flexible schema but poor for financial data requiring strict consistency
- SQLite — excellent for local dev but not suitable for production workloads or concurrent access

**Consequences**
- All data in one system, simplifying operational overhead
- Time-series performance addressed via partitioning (native PostgreSQL) — to be evaluated in Phase 2
- If native partitioning proves insufficient, TimescaleDB extension is a drop-in upgrade
- Drizzle ORM is the exclusive data access layer; no raw SQL in application code

**Review Trigger**
Phase 2 performance benchmarks show PostgreSQL cannot handle required query volumes. TimescaleDB extension will be the first upgrade path evaluated.

---

### ADR-004 — Documentation-First Workflow

**Date**: 2026-05-31
**Status**: Accepted
**Author**: Project founder

**Decision**
All features must be documented before or alongside implementation. No feature is considered complete without documentation. Documentation lives in the repository, not in external tools.

**Context**
This is a long-term project that will involve multiple AI agents, each starting with no session history. Without strong in-repo documentation, every agent session begins from zero.

**Rationale**
Documentation in the repository is version-controlled alongside code, always in sync, accessible to AI agents, and does not require external tool access. The AGENTS.md protocol enforces this as a mandatory post-coding step.

**Alternatives Considered**
- Notion / Confluence — richer editing experience but external, not AI-agent accessible, not version-controlled
- Code comments only — insufficient for architecture decisions and cross-cutting concerns
- GitHub Wiki — version controlled but separate from code, easy to fall out of sync

**Consequences**
- Every session must end with updated documentation before being considered complete
- Initial overhead is higher but pays compound dividends as the project grows
- AI agents can orient themselves within 5 minutes of opening the repository
- CHANGELOG, TODO, and DECISIONS files are living documents, always current

**Review Trigger**
Documentation burden becomes so high that it slows development to an unacceptable degree. In that case, the documentation format will be simplified — but the practice of in-repo documentation will not be abandoned.

---

### ADR-005 — pnpm Workspaces as Monorepo Structure

**Date**: 2026-05-31
**Status**: Accepted
**Author**: Project founder

**Decision**
Use pnpm workspaces to manage the monorepo, with shared libraries in `/lib` and deployable artifacts in `/artifacts`.

**Context**
The platform has multiple components (API server, frontend, shared types, generated API clients) that need to share code without duplication.

**Rationale**
pnpm workspaces provide fast installs, strict dependency isolation, and native monorepo support. The existing Replit workspace template uses this structure, providing a pre-configured foundation.

**Alternatives Considered**
- npm workspaces — slower, no disk deduplication
- Yarn workspaces — similar capability but pnpm is faster
- Nx or Turborepo — powerful but adds significant tooling complexity not yet needed

**Consequences**
- Shared code lives in `/lib` packages with `@workspace/` prefix
- All packages declare their own dependencies explicitly
- `pnpm --filter` is used for targeted package commands
- Root `package.json` is for repo-level tooling only

**Review Trigger**
Build times or tooling complexity become problematic at scale.

---

### ADR-006 — OpenAPI Contract-First API Development

**Date**: 2026-05-31
**Status**: Accepted
**Author**: Project founder

**Decision**
All API endpoints are defined in the OpenAPI spec (`lib/api-spec/openapi.yaml`) before any implementation code is written. Orval generates React Query hooks and Zod schemas from the spec.

**Context**
The platform has a clear frontend/backend separation. A contract is needed to allow parallel development and prevent integration drift.

**Rationale**
Contract-first development ensures the API is designed before it is implemented, preventing design by accident. Generated clients eliminate hand-written fetch code and ensure frontend/backend stay in sync. The existing workspace template includes this infrastructure.

**Alternatives Considered**
- tRPC — excellent type safety but couples frontend and backend too tightly; harder to expose to external consumers
- GraphQL — flexible but high complexity overhead for a personal project
- Code-first (generate spec from code) — easier to start but spec often drifts from implementation

**Consequences**
- Spec changes must precede implementation changes
- Codegen must be run after every spec change
- Generated files are not manually edited
- Breaking API changes require explicit versioning

**Review Trigger**
The number of API endpoints grows to a point where maintaining the spec manually becomes impractical. In that case, a spec generation tool will be evaluated.

---

### ADR-007 — Strategy Framework: TypeScript-Native, Server-Side Only

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 3 implementation)

**Decision**
Implement all research strategies in TypeScript, running inside the API server process. No separate Python subprocess or external strategy runner for Phase 3.

**Context**
The original PROJECT_MASTER.md noted that Python may be introduced for research in Phase 3+. A decision was needed on whether to introduce Python now or stay TypeScript-native.

**Rationale**
Phase 3 focuses on establishing the research infrastructure (strategy interface, backtesting engine, performance metrics, API). The backtesting compute load at this stage (replaying historical candles, computing indicators) is well within Node.js capabilities. Introducing a Python subprocess would add process management complexity, IPC serialization, and a second runtime to maintain — all without material benefit at this stage. TypeScript-native strategies integrate naturally with the Drizzle ORM layer, the Express API, and the existing test/build toolchain. Python integration remains on the roadmap for Phase 9 (AI Research Assistant) where LLM/ML workloads would genuinely benefit from the Python ecosystem.

**Alternatives Considered**
- Python subprocess (child_process) — adds IPC complexity, two runtimes; deferred to Phase 9
- Separate Node.js microservice — over-engineering for a personal project at this stage
- WASM-compiled Python (Pyodide) — experimental, significant bundle size impact

**Consequences**
- Strategies are TypeScript classes implementing `IStrategy`
- Strategy code lives in `artifacts/api-server/src/strategies/`
- Adding a new strategy requires zero infrastructure changes — just implement and register
- Python integration will be re-evaluated in Phase 9 when ML/LLM work begins

**Review Trigger**
Strategy computation becomes CPU-bound and blocks the event loop; or researchers want to write strategies in Python/pandas/numpy.

---

### ADR-008 — Backtesting Execution Model: Next-Candle-Open Fill

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 3 implementation)

**Decision**
BUY and SELL signals generated at candle N are executed at the open price of candle N+1.

**Context**
A signal is generated after observing candle N's close. In reality a trader cannot transact at the close price of the candle that triggered the signal — they can only transact when the next session opens. This decision determines whether fill prices are realistic.

**Rationale**
Executing at the current candle's close price is a common source of look-ahead bias (the "peeking" problem). Using the next candle's open price is a widely accepted conservative approximation that eliminates this bias at minimal implementation cost. Phase 4 will add more sophisticated fill models (VWAP, limit order queuing, slippage models).

**Alternatives Considered**
- Fill at current candle close — look-ahead bias; rejected
- Fill at current candle close + fixed slippage — still biased, and slippage is arbitrary
- VWAP fill simulation — more realistic but requires intrabar data not available in Phase 3
- Separate order book simulation — correct for Phase 4; deferred

**Consequences**
- Backtests are conservative (may slightly understate achievable returns)
- No look-ahead bias by construction
- One candle of "latency" is built into all entry/exit timings
- Phase 4 can upgrade the fill model without changing the strategy interface

**Review Trigger**
Phase 4 introduces a full order book simulation, at which point this fill model will be superseded.

---

### ADR-009 — Performance Metrics Stored as Numeric Strings

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 3 implementation)

**Decision**
All performance metric values (percentages, ratios) are stored in PostgreSQL as `numeric` columns and serialized to/from JavaScript as strings (not floats).

**Context**
Financial calculations require exact decimal precision. JavaScript `number` (IEEE 754 double) loses precision for financial values (e.g., 0.1 + 0.2 ≠ 0.3). A storage and serialization strategy was needed.

**Rationale**
PostgreSQL `numeric` is arbitrary-precision and lossless. Drizzle ORM maps `numeric` columns to JavaScript strings, not numbers, preserving full precision. This is consistent with the existing `candles` table where OHLCV values are also stored as `numeric` and returned as strings. Consumers who need arithmetic should parse the string to a `Decimal` library for financial precision.

**Alternatives Considered**
- `float8` / `double precision` — fast but lossy; inappropriate for financial metrics
- `bigint` scaled integers (e.g., multiply by 10^8) — precise but requires manual scaling everywhere
- JavaScript `BigDecimal` library — correct but adds a dependency; push to consumer layer

**Consequences**
- All percentage/ratio fields in API responses are strings
- Frontend and any downstream consumers must parse strings before arithmetic
- No precision loss in storage or transmission
- Consistent with existing candles data model

**Review Trigger**
A downstream consumer encounters significant friction from string parsing, at which point a `Decimal.js` utility layer will be considered.

---

### ADR-010 — Position Sizing Integrated into Backtesting Engine (Simulation Only)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 4 implementation)

**Decision**
Position sizing is implemented as a backtesting-time calculation inside the engine. It sizes simulated entries only — it does not enforce risk limits on real capital.

**Context**
Phase 4 adds a position sizing framework with 5 methods (Fixed Dollar, Fixed Percentage, Risk Percentage/ATR, Volatility-Based, Kelly Criterion). The question arose whether this sizing engine should be reused in Phase 5 (paper trading) or Phase 6 (risk engine) directly.

**Rationale**
Phase 4's position sizer sizes hypothetical positions for historical replay. It does not interact with any real account, broker, or capital. Reusing it in paper trading or live risk management would conflate research sizing (what *would* have worked) with execution sizing (what we *will* do). The Phase 6 risk engine will implement its own position sizing that is capital-aware, account-balance-aware, and integrated with the risk limit system.

**Alternatives Considered**
- Shared sizing service for backtest + paper trading — couples research and execution too early
- Defer all sizing to Phase 6 — misses the research value of simulating different sizing strategies in backtest

**Consequences**
- `position-sizer.ts` and `position-sizing-profiles` table are scoped to the research namespace
- Phase 6 risk engine will have its own position sizing implementation with live-capital semantics
- Research results can compare different sizing methods historically without risk engine dependency

**Review Trigger**
Phase 5/6 implementation reveals enough shared logic that a common sizing abstraction is clearly beneficial.

---

### ADR-011 — Monte Carlo Via Trade Shuffling (Not Price Path Simulation)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 4 implementation)

**Decision**
Monte Carlo analysis is implemented by randomly reordering the sequence of trades from a completed backtest (bootstrap resampling), not by simulating alternative price paths.

**Context**
Two common Monte Carlo approaches exist for strategy validation: (1) resample the trade P&L sequence to estimate the distribution of equity curves, or (2) generate synthetic price paths via GBM or similar and re-run the strategy. Both test robustness but answer different questions.

**Rationale**
Trade shuffling is computationally cheap (microseconds per simulation), requires no additional market data or price model assumptions, directly tests the sensitivity of the equity curve to trade ordering luck, and is the standard approach in retail quant tools. Price-path simulation is more theoretically correct but requires calibrating a return distribution model and re-running the full strategy on each path — orders of magnitude more expensive. For the validation use case (detecting excessive luck or drawdown sensitivity), trade shuffling is sufficient and more interpretable.

**Alternatives Considered**
- GBM price-path simulation — more rigorous but expensive; deferred to future advanced validation module
- Historical block bootstrap — preserves autocorrelation structure; complexity not justified at this stage
- Parametric (normal distribution) — fast but assumes normality; financial returns are fat-tailed

**Consequences**
- Simulations complete in milliseconds for typical trade sets (< 10,000 trades)
- Seeded PRNG (mulberry32) makes results exactly reproducible
- Results test ordering-luck sensitivity, not parameter sensitivity or price-path sensitivity
- Parameter sensitivity testing is a separate concern (grid search / optimization — future phase)

**Review Trigger**
Researchers need price-path sensitivity analysis, at which point a GBM or block-bootstrap module will be added.

---

### ADR-013 — Paper Trading as Isolated Simulation Layer (Phase 5)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 5 implementation)

**Decision**
Phase 5 implements paper trading as a fully isolated simulation layer: separate DB tables, separate service modules, separate API routes, and a dedicated in-process scheduler. No code paths shared with the Phase 4 backtesting engine at runtime.

**Context**
Paper trading must bridge the gap between historical backtesting (Phase 3–4) and live execution (Phase 8). It needs to run continuously against real market prices, maintain persistent account state, and produce auditable fill records. Two architectural options existed: (a) extend the backtesting engine to support real-time mode, or (b) build a fresh simulation layer purpose-built for persistent, stateful, real-time operation.

**Rationale**
The backtesting engine is optimized for batch replay over historical data — it processes thousands of candles per second in a single-threaded loop, produces ephemeral result objects, and has no concept of persistent account state. Extending it to real-time would require a significant redesign. A fresh layer enables: (1) clean separation of concerns, (2) independent schema design optimized for real-time state persistence, (3) no risk of regressing the validated Phase 3–4 backtest behavior, (4) the same `IStrategy` interface is reused via the signal engine — strategies don't change, only the execution context does.

**Alternatives Considered**
- Extend backtesting engine for real-time mode — would require restructuring core batch loop; risks regressing validated backtest behavior
- External message queue (Kafka/Redis Pub/Sub) for order routing — adds infrastructure complexity not warranted for a single-operator platform; in-process scheduler is simpler and sufficient

**Consequences**
- Paper trading and backtesting are independently maintainable and deployable
- Strategy code is reused without modification (same `IStrategy.generateSignals()` contract)
- The scheduler runs inside the API server process; for Phase 8, it would migrate to a dedicated worker process or external job runner
- Position sizing in Phase 5 uses a simple 10% fixed-fraction rule (independent of the Phase 4 position sizer) — ADR-010 position sizer will be integrated in Phase 6 as part of the risk engine

**Review Trigger**
When moving to live execution (Phase 8), the scheduler must be extracted to a dedicated worker process with guaranteed-delivery semantics and crash recovery.

---

### ADR-012 — Equity Curves Stored as Compact JSON (Not Row-Per-Point)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent (Phase 4 implementation)

**Decision**
Equity curve time-series are stored as a single JSONB column (`compact_json`) in the `equity_curves` table, using a compact `{ t, e, d }` format (timestamp, equity, drawdown). One row per run — not one row per time point.

**Context**
A typical daily backtest over 3 years produces ~1,000 equity points. A 20-symbol portfolio backtest could produce 20,000 points. Storing these as individual rows would require a join and significant row overhead per retrieval.

**Rationale**
For read-heavy research use (displaying a chart, computing statistics), bulk retrieval of the entire time-series is far more common than point queries. A single row with compressed JSON achieves: (1) O(1) retrieval cost regardless of series length, (2) no JOIN needed, (3) PostgreSQL JSONB is indexed and queryable if point queries are ever needed, (4) compact format reduces storage to ~30 bytes per point vs ~200 bytes per row. The `{ t, e, d }` format is chosen over full ISO timestamps to minimize JSON payload size.

**Alternatives Considered**
- Separate `equity_curve_points` table (one row per point) — easy to query individual points but slow bulk retrieval; 6–7× more storage
- TimescaleDB hypertable — optimal for time-series but adds infrastructure dependency
- CSV/Parquet file in object storage — efficient but adds I/O complexity and no direct DB query support

**Consequences**
- Equity curve retrieval is a single SELECT by run ID — O(1) regardless of series length
- The compact format must be expanded server-side before serving to API consumers
- Point-level SQL queries on equity curves are possible via `jsonb_array_elements` but expensive
- Maximum practical series length is bounded by PostgreSQL row size limit (~1GB); effectively unlimited for backtest use

**Review Trigger**
Equity curves grow beyond ~100,000 points per run (multi-year tick-level backtests), at which point partitioned row storage or object storage will be evaluated.

---

## ADR-014: Kill Switch State is In-Memory, Not Database-Authoritative

**Decision**
The Phase 6 kill switch service stores its authoritative state in a Node.js in-memory structure (Sets and booleans) within the API server process. The database (`kill_switch_events`) is an immutable audit trail, not the source of truth for real-time trading decisions.

**Context**
A kill switch must halt trading with zero latency. If the kill switch check required a database round-trip on every pre-trade evaluation, the risk engine would be subject to DB latency, connection pool exhaustion, and network partitions — precisely the failure modes that most require a kill switch.

**Rationale**
In-memory checks are nanosecond-latency vs. millisecond-latency for DB. The pre-trade path evaluates 13 checks synchronously; adding a DB round-trip would multiply latency. The trade-off is that state is lost on server restart — acceptable because: (1) a restart is an operational event that should be followed by a manual review before resuming trading, (2) the audit log allows reconstruction of state, (3) future phases can add a startup rehydration step from the DB if needed.

**Alternatives Considered**
- DB-authoritative state (SELECT on every check) — correct but adds latency and availability risk
- Redis/cache — adds infrastructure dependency for a single-process server; revisit in Phase 8 when multi-process is needed
- Re-hydrate from DB on startup — valid addition in Phase 7+ but not required for correctness in Phase 6

**Consequences**
- Kill switch checks are O(1) with no I/O
- Kill switch state is lost on process restart (server restart implicitly clears all halts)
- Every activate/resume writes an immutable `kill_switch_events` row for auditing
- `isSchedulerPaused()` must be checked at the top of every risk scheduler loop

**Review Trigger**
When the API server moves to a multi-process deployment (Phase 8+), kill switch state must be migrated to Redis or a DB-backed shared store.

---

## ADR-015: Risk Engine Checks are Sequential, Not Parallel

**Decision**
The 13 pre-trade risk checks in `risk-engine.ts` execute in a fixed priority order, halting at the first failure and returning immediately. Checks are not evaluated in parallel.

**Context**
Pre-trade validation must return a definitive decision before order execution. The checks have an implicit priority hierarchy: a global trading halt must short-circuit before any account-level check; account checks must complete before position-size checks; etc.

**Rationale**
Sequential fail-fast evaluation: (1) preserves check priority (a global halt takes precedence over a position-size warning), (2) avoids partial results where two checks both fail but only one is surfaced to the operator, (3) avoids running expensive DB queries (position count, drawdown calculation) when an earlier cheap check (kill switch, circuit breaker) would have rejected the order anyway, (4) produces a single, unambiguous reject reason rather than a list of violations that could be confusing.

**Alternatives Considered**
- Parallel evaluation + aggregate — surfaces all failures simultaneously but loses priority ordering and may run expensive queries unnecessarily
- Weighted scoring system — more nuanced but harder to reason about and audit; "approved with score 0.4" is less operationally clear than "rejected: drawdown limit exceeded"

**Consequences**
- A rejected order always has exactly one primary reason (the first check that failed)
- Later checks may also be violated but are not surfaced; operators must resolve violations incrementally
- Check ordering is a contract — changes to the sequence must be documented in DECISIONS.md
- All decisions (approved or rejected) are stored in `risk_decisions` for post-trade analysis

**Review Trigger**
When operators request a "full violation report" for a single order, parallel evaluation with aggregated results will be considered.

---

## ADR-016: Risk Profiles are Profile-Wide Defaults, Not Per-Strategy Overrides

**Decision**
A risk profile defines capital limits for an entire account. There is no mechanism in Phase 6 to apply different limits to different strategies on the same account.

**Context**
The profile design question was whether limits should be per-account, per-strategy, or per-assignment. Per-strategy limits would allow a research strategy to have relaxed limits while a production strategy has strict ones, on the same account.

**Rationale**
Keeping profiles account-wide simplifies the pre-trade engine: one profile lookup per account, one set of limits per evaluation. It also enforces a natural mental model: if you want different risk tolerances, use different accounts. This is the institutional standard — desks run separate accounts for different risk mandates, not strategy-level overrides within one account. Per-strategy limits add complexity without solving a problem that can't be addressed by account segregation.

**Alternatives Considered**
- Per-strategy overrides within an account — more flexible but adds a merge/precedence problem (does the strategy override the account profile or add to it?)
- Per-assignment limits — even more granular but makes the data model and UI substantially more complex

**Consequences**
- Operators who want different risk tolerances for different strategies must create separate paper accounts
- One profile can be the default (`isDefault: true`); accounts without an explicit profile inherit the default
- Phase 7 can introduce per-strategy overlays as additive constraints (strategy overlay ≤ account profile limit)

---

## ADR-017: Portfolio Analytics Uses Computed Snapshots, Not Real-Time Aggregation

**Decision**
All portfolio analytics (performance metrics, health scores, attribution, recommendations) are computed asynchronously by background schedulers and stored as snapshots in the database. API endpoints read pre-computed results; they do not recompute on request by default.

**Context**
Two viable approaches: (A) compute all metrics on-demand at query time by reading raw trade/position data; (B) compute on a schedule, store results, and serve from the analytics tables. The on-demand approach is simpler to implement but expensive at query time for large portfolios; the snapshot approach adds latency to "freshness" but is O(1) at read time regardless of portfolio size.

**Rationale**
Phase 7 targets portfolios with months of trade history and multiple concurrent strategies. Computing TWR from raw fills for a 1-year portfolio on every API call would be unacceptably slow. The scheduler approach also allows retroactive recomputation (e.g. after a data correction) without coupling the API to heavy computation. All endpoints expose a `POST .../compute` trigger for on-demand refresh when needed.

**Alternatives Considered**
- Pure on-demand aggregation — simple but O(N) at read time, not viable for large portfolios
- Materialized views — database-level, but hard to implement incremental TWR correctly; less flexible than application-layer computation
- Hybrid: cache in Redis — adds infra complexity not justified for a personal platform

**Consequences**
- Analytics data is at most 1 schedule-interval stale (health: 1h, performance: 1d, allocation: 15m)
- Each analytics domain exposes a `POST .../compute` endpoint for immediate refresh
- `analytics_audit_log` records every computation event, so freshness is always auditable
- Phase 8+ can switch to streaming/real-time for specific hot metrics without changing the API contract

---

### ADR-018 — LLM Provider Abstraction Layer (Phase 8)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
Implement a pluggable `ILlmProvider` interface with four concrete adapters (OpenAI, Anthropic, Gemini, Mock) selected at runtime via the `AI_PROVIDER` environment variable. Missing API key falls back to MockLlmProvider rather than crashing.

**Context**
Phase 8 introduces AI capabilities. The choice of LLM provider is a volatile configuration decision — operators may prefer different providers for cost, capability, privacy, or availability reasons. Hardcoding a single provider creates migration friction. Additionally, the platform must remain runnable during development without requiring any paid API key.

**Rationale**
- `ILlmProvider` interface enforces a uniform contract (`chat()`, `name`, `defaultModel`, `countTokens()`) regardless of upstream API shape
- `AiProviderFactory.getProvider()` is a singleton; the provider is selected once at startup from `AI_PROVIDER` env var
- Mock provider is the default — zero-config startup, deterministic structured responses, useful for integration testing
- Fallback-to-mock on missing API key is explicit behavior, not silent — logged at startup so operators know which provider is active
- Provider switching requires only an env var change — no application code changes, no deployment rebuild

**Alternatives Considered**
- Single hardcoded provider (OpenAI) — rejected: locks the platform; migration cost is high once schema and usage patterns are baked in
- Direct provider SDK calls in routes — rejected: violates DRY, makes provider switching a multi-file refactor, no auditability
- Plugin/dynamic loading — rejected: over-engineering for a personal platform; four providers cover all realistic needs

**Consequences**
- Adding a fifth provider requires only: a new `*-provider.ts` implementing `ILlmProvider`, and one case in `AiProviderFactory`; no other changes
- All token usage is recorded via `ai_usage_metrics` regardless of provider; cost tracking works uniformly
- Mock provider responses are structured and tagged `[MOCK]` — easy to distinguish from real responses in audit logs
- Provider/model is recorded in every DB row (conversation, report, insight, audit log) for complete reproducibility

---

### ADR-019 — AI Advisory-Only Safety Architecture (Phase 8)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
The AI Research Assistant is unconditionally advisory-only. It has read-only access to platform data and cannot execute trades, approve/reject orders, override risk controls, bypass circuit breakers, or modify any platform state. This is enforced architecturally at the application layer, not by LLM instruction alone.

**Context**
AI systems that can influence financial decisions carry significant risk. Even with a well-designed system prompt, LLMs can be manipulated (prompt injection, jailbreaks). A personal platform with real capital requires hard architectural guarantees, not soft AI-layer promises.

**Rationale**
- AI services only call read-only DB helpers — they have no write access to orders, positions, risk profiles, or account state
- The system prompt contains an explicit advisory boundary statement in every call to the LLM
- All AI API routes are separate (`/v1/ai/`) from all action routes; no AI route calls execution services
- Audit log records every AI interaction — any attempt to use AI output to take action is independently logged and traceable
- This boundary is preserved in all Phase 9+ work: execution engine must never accept AI output as a direct trigger

**Alternatives Considered**
- AI with controlled write access — rejected: unnecessary complexity; Phase 8 goal is insight and explanation, not automation
- AI with optional "apply recommendation" action — rejected: deferred to Phase 9+ pending full execution engine and kill switch integration; advisory boundary maintained until then

**Consequences**
- AI cannot be used as an autonomous trading agent without explicit Phase 9+ architecture changes
- Human-in-the-loop is guaranteed by construction, not by instruction
- Audit log provides full traceability of all AI interactions for compliance review

---

### ADR-020 — In-Memory EventEmitter Event Bus with DB Audit (Phase 9)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
Use Node.js `EventEmitter` as the internal event bus for the streaming infrastructure. Significant lifecycle events (StreamConnected, StreamDisconnected, GapDetected, RecoveryTriggered, etc.) are persisted to the `event_bus_events` table for audit and replay. High-volume events (TickReceived, OrderBookUpdated, TradeReceived) are NOT individually persisted via the event bus — they are handled directly by their respective processors which write to dedicated tables.

**Context**
A streaming infrastructure requires a pub/sub mechanism for decoupling: the connection manager fires events, and processors/health engines subscribe. Options: in-process EventEmitter, Redis pub/sub, or a message queue (RabbitMQ, Kafka).

**Rationale**
- EventEmitter is zero-dependency and zero-latency — appropriate for a single-process personal platform
- Redis adds infra complexity with no benefit at single-node scale
- High-volume events (ticks at 4 symbols × 1/sec = ~14,400/hour) would overwhelm the audit table if individually logged; processors write directly to `market_ticks`, `market_orderbooks`, `market_trades`
- Lifecycle events (connect, disconnect, gap, recovery) are low-volume and high-value — worth persisting

**Consequences**
- Event bus is in-process only — no cross-process fan-out (not needed at personal platform scale)
- 50-listener cap on EventEmitter to catch accidental unbounded subscription bugs
- Audit table provides replay capability for lifecycle events; tick replay uses `market_ticks` directly

---

### ADR-021 — IStreamProvider Abstraction Layer (Phase 9)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
Define an `IStreamProvider` interface that all streaming data sources implement. Provider is selected at runtime via `STREAM_PROVIDER` environment variable. Default is `mock`. Pattern mirrors `ILlmProvider` (ADR-018) for consistency.

**Context**
The platform will eventually support multiple asset classes: crypto (Binance), forex (OANDA/IB), equities (Polygon/Alpaca). Hardcoding Binance locks the platform to one market and creates migration friction.

**Rationale**
- `IStreamProvider` defines: `connect()`, `disconnect()`, `subscribe()`, `unsubscribe()`, `isConnected()`, `onEvent()`, `onError()`, `onDisconnect()`, `getSubscribedSymbols()`
- `MockStreamProvider` is the default — generates realistic synthetic prices with random walk; no network or API key needed
- `BinanceWebSocketProvider` uses lazy `ws` import — server starts even if `ws` is not installed; only fails when Binance provider is explicitly selected
- Adding a new provider requires: one new file implementing `IStreamProvider`, one case in `StreamProviderFactory`; no other changes

**Consequences**
- Provider switching requires only an env var change and server restart
- `StreamConnectionManager` is provider-agnostic — no Binance-specific logic in the manager
- Forex/equities stubs throw `NotImplemented` — clear signal that they're placeholders

---

### ADR-022 — In-Memory Market State Engine with Periodic Snapshots (Phase 9)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
Maintain a `Map<symbol, MarketState>` as the source of truth for current market state. Compute VWAP, momentum (EMA of price change %), and volatility (rolling std dev of returns) incrementally on each tick. Persist snapshots to `market_state_snapshots` every 30 seconds.

**Context**
APIs need to serve current market state with sub-millisecond latency. Two options: (A) query the DB on each request computing from raw ticks; (B) maintain in-memory state, serve from Map, and snapshot periodically.

**Rationale**
- DB query approach: O(N ticks) at read time, too slow for high-frequency reads
- In-memory Map: O(1) reads regardless of tick history; appropriate for a single-process platform
- VWAP uses running weighted mean (not a fixed window) — simple and consistent
- Snapshots every 30s are sufficient for analytics; real-time consumers use the live map
- API falls back to DB snapshot if streaming is inactive (e.g. STREAM_ENABLED=false)

**Consequences**
- Market state is lost on server restart; recovers within seconds when stream reconnects
- 30-second snapshot lag means analytics queries are at most 30s stale for non-live consumers
- Map holds one MarketState per tracked symbol — memory footprint is trivial

---

### ADR-023 — DB-Backed Tick Replay Engine (Phase 9)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
Implement tick replay by reading stored rows from `market_ticks` and firing `TickReceived` events through the event bus at a configurable speed multiplier (1x, 5x, 10x, 100x). Max one concurrent replay session.

**Context**
Strategy testing, UI development, and incident analysis all benefit from replaying historical market conditions. Options: (A) re-stream from exchange with time-travel API; (B) replay stored ticks from DB.

**Rationale**
- Exchange time-travel APIs have rate limits and are unavailable for all providers; DB-stored ticks are always available
- Firing through the event bus means all existing subscribers (market state engine, processors) receive replay events identically to live events
- Speed multiplier uses scaled `setTimeout` between ticks — simple and precise for moderate speeds
- Single-session limit prevents DB read amplification; personal platform doesn't need multi-replay
- AbortController enables clean stop without setTimeout leaks

**Consequences**
- Replay fidelity is limited to stored tick resolution (1/sec for mock; exchange-rate for Binance)
- Very large replay windows (millions of ticks) should be run at 100x to avoid excessive replay time
- Replay events are tagged with `replayId` in the payload so subscribers can distinguish live from replay

---

### ADR-024 — Gap Detection via Timestamp Comparison (Phase 9)

**Date**: 2026-06-01
**Status**: Accepted
**Author**: AI agent

**Decision**
Detect streaming gaps by comparing the time since last tick per symbol to a configurable threshold (default: 10 seconds). Run gap checks every 15 seconds. On gap detection: record a failure event, trigger OHLCV backfill via the existing Binance REST client, and record a recovery event.

**Context**
WebSocket streams can silently stall — the connection stays open but messages stop flowing. Heartbeat monitoring alone (Binance sends ping every 3min) is too coarse for data-quality purposes.

**Rationale**
- Per-symbol `lastTickTime` map in RecoveryService enables independent gap detection per symbol
- 10-second threshold is conservative: at 1 tick/sec (mock rate), a 10s gap is clearly anomalous; at Binance rates (multiple per second), it's equally clear
- OHLCV backfill uses the existing `BinanceClient.fetchKlines()` — no new dependency; fills the gap with 1m candle close prices (synthetic ticks)
- Recovery events recorded with full timing, estimated vs recovered tick counts, and success flag

**Consequences**
- Gap detection adds negligible overhead (Map lookup every 15s per symbol)
- Backfill via OHLCV provides approximate data — not exchange-exact ticks — but sufficient for analytics continuity
- False positives possible during provider transitions (deliberate disconnect); recovery service checks session status before acting

---

### ADR-025 — Execution Mode Safety Constraint (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
The OMS accepts only three execution modes: `simulation`, `paper`, and `live_disabled`. The string `"live"` is not a valid mode. The scheduler validates `EXECUTION_MODE` on startup and throws if an invalid value is supplied. `live_disabled` mode starts the OMS but blocks all orders at the provider stub level.

**Context**
Phase 10 introduces real order submission infrastructure. Without an explicit safety constraint, a misconfigured env could route orders to a real exchange.

**Rationale**
Hard rejection at scheduler startup (not at order time) means the failure is loud and early, never silent. The three-value enum forces conscious opt-in to paper mode and makes live trading structurally impossible in Phase 10.

**Alternatives Considered**
- Guard at provider level only — rejected because it's too late in the pipeline; state machine and DB records would already exist
- Feature flag — rejected in favor of the cleaner env-var enum

**Consequences**
- All existing test environments (EXECUTION_MODE=simulation) work without change
- No code path exists from which live order submission is reachable
- Future live trading requires a new provider implementation, a new enum value, and a deliberate ADR

**Review Trigger**
If live trading is introduced in a future phase, this ADR is superseded.

---

### ADR-026 — Order State Machine with Illegal-Transition Enforcement (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
All order status transitions are governed by an explicit allowed-transitions map. Attempting an illegal transition throws synchronously. Every legal transition is persisted to `execution_order_events` atomically with the status update.

**Context**
Without a formal state machine, concurrent service calls (monitor, recovery, OMS) could corrupt order status by racing to write conflicting terminal states.

**Rationale**
Explicit transition map makes invariants readable and auditable. Synchronous throw on illegal transition surfaces bugs immediately in development and prevents silent corruption in production.

**Consequences**
- All status updates must go through `transition()` — direct DB status writes are prohibited
- Event log is always consistent with state history

---

### ADR-027 — Four-Stage Pre-Trade Pipeline (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Every order passes through four sequential gates before routing: (1) schema/field validation, (2) Phase 6 risk engine snapshot check (position sizing, drawdown), (3) kill-switch check, (4) circuit-breaker check per symbol. Rejection at any stage records the reason and stage to `execution_rejections`.

**Context**
Institutional execution requires a documented, auditable pre-trade compliance layer. Each gate is independently testable and the stage label on rejections enables per-stage rejection-rate analytics.

**Rationale**
Sequential gates are simpler to reason about than parallel checks. Stopping at first failure minimizes DB writes on clearly-invalid orders. Recording stage on rejection enables analytics on where orders are dying.

**Consequences**
- Adding a new pre-trade check requires only inserting a new stage function — no structural changes
- All rejections are persisted with full detail for compliance audit

---

### ADR-028 — Mode-Aware Provider Router with Health Tracking (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
`ExecutionRouter` selects the active provider based on `EXECUTION_MODE`. It health-checks all providers on startup and tracks per-provider latency. A `live_disabled` stub provider is returned for that mode — it rejects all orders at the provider level with a clear error message.

**Context**
The router pattern matches the Phase 9 `StreamProviderFactory` and Phase 8 `AiProviderFactory`. Consistent provider abstraction makes future provider additions trivial.

**Consequences**
- Adding a new execution provider requires only implementing `IExecutionProvider` and registering in the router

---

### ADR-029 — Fill Engine with Slippage and Commission Tracking (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Fill processing is separated from order routing. The fill engine receives a `ProviderFillResult`, computes slippage in basis points relative to the order's reference price, applies a 0.1% commission, writes an `ExecutionFill` record, and publishes a `FillReceived` event.

**Rationale**
Separating fill processing from provider logic enables consistent fill accounting regardless of provider. Slippage in bps is provider-agnostic and directly comparable across simulation and paper modes.

**Consequences**
- `avgFillPrice` on the order is recomputed as a weighted average across all partial fills
- Commission is tracked separately from fill price for P&L accuracy

---

### ADR-030 — Position Engine with Average-Cost Basis (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Positions are maintained with a running average-cost basis. Each fill updates `avgEntryPrice` as a weighted average. Closing a position records `realizedPnl` as `(exitPrice - avgEntry) * quantity` (adjusted for side). Mark-to-market updates `unrealizedPnl` using Phase 9 `MarketStateEngine.lastPrice`.

**Rationale**
Average-cost basis is the standard institutional position accounting method. Separating realized from unrealized P&L enables accurate performance attribution.

---

### ADR-031 — Execution Monitor with Stale/Stuck Order Detection (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
A background monitor polls active orders every 30 seconds. Orders acknowledged but not filled within 5 minutes are flagged as stale (recovery record created). Orders in any active state for more than 30 minutes are auto-failed with an audit log entry.

**Rationale**
In simulation/paper mode there is no exchange timeout — the monitor provides the equivalent guarantee. Thresholds (5min stale, 30min stuck) are conservative and configurable in future phases.

---

### ADR-032 — Execution Analytics with Multi-Period Aggregation (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Quality metrics (fill rate, reject rate, avg/p50/p95/p99 latency, avg slippage) are computed over four time windows (1h, 4h, 1d, 7d) for each execution mode every 5 minutes and written to `execution_metrics`.

**Rationale**
Pre-aggregation avoids expensive real-time aggregation queries at the API layer. Four windows cover both operational alerting (1h) and trend analysis (7d).

---

### ADR-033 — Execution Recovery Service (Phase 10)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
A recovery service polls every 60 seconds for: (1) orders in `routed` state for >30s (lost ACK), (2) orders in `acknowledged` state for >5min (lost fill), (3) orders stuck in `recovering` for >10min. In simulation mode, automated resolution cancels the order. All recovery actions are persisted to `execution_recovery`.

**Rationale**
Simulation and paper providers are in-process, so lost ACK/fill indicates a code bug rather than network failure. Automated cancel-on-timeout prevents the order book from accumulating zombie orders.

**Consequences**
- Recovery events provide a debug signal for provider implementation bugs
- In future live mode, recovery would query the exchange API rather than auto-cancel

---

### ADR-034 — Intelligence DB Persistence Layer (Phase 11)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
All Phase 11 persistence is centralized in `intelligence-db.ts` — a single module exposing typed CRUD helpers for: strategy_rankings, market_regimes, portfolio_allocations, allocation_history, strategy_clusters, strategy_correlations, optimization_runs, optimization_results, strategy_generations, ai_agent_tasks, research_sessions.

**Rationale**
Centralizing DB access in one module prevents import cycles between Phase 11 services, makes the persistence contract explicit, and simplifies future schema migrations.

**Consequences**
- All Phase 11 services import from `./intelligence-db`, never from `@workspace/db` directly for intelligence tables
- Adding a new intelligence table requires one schema file + additions to intelligence-db.ts only

---

### ADR-035 — Regime Detection Ensemble (Phase 11)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Market regime is classified using a 6-indicator heuristic ensemble (trend slope, annualized volatility, ADX proxy, average RSI, volume ratio, net return) rather than an ML model. Output is one of 5 regime types: `bull | bear | sideways | high_volatility | low_volatility`.

**Rationale**
Heuristic ensembles are deterministic, require no training data, and degrade gracefully with thin candle history. They can be replaced with an ML model in a future phase without changing the downstream interface.

**Consequences**
- Minimum 20 candles required for a valid regime detection (THRESHOLDS.MIN_CANDLES)
- Confidence scores are heuristic (not probabilistic) — consumers should treat them as relative, not absolute

---

### ADR-036 — Strategy Optimizer Multi-Method Architecture (Phase 11)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
The strategy optimizer supports 4 methods in a single service: `grid_search` (exhaustive), `random_search` (Monte Carlo sampling), `bayesian` (Gaussian process with expected improvement), and `genetic` (delegates to GeneticEvolutionEngine). All methods share the same `OptimizationConfig` input and `OptimizationRun`/`OptimizationResult` DB schema.

**Rationale**
A unified interface allows callers to switch methods without code changes. Bayesian and genetic methods reuse grid/random trials as warm-starts where applicable.

**Consequences**
- `BacktestRequest` uses `interval` (not `timeframe`) and `params` (not `parameters`) — must match research-runner interface exactly
- Each optimizer evaluation calls `executeBacktest` via the Phase 4 research runner — optimization is bounded by backtest throughput

---

### ADR-037 — Intelligence Scheduler Loop Architecture (Phase 11)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Phase 11 uses 5 independent background loops with configurable intervals: regime detection (60 min), strategy ranking (6 hr), correlation clustering (12 hr), research coordination (30 min), continuous learning (2 hr). All loops are non-fatal — errors are logged but do not crash the scheduler.

**Rationale**
Independent loops allow each intelligence function to run at its natural cadence. Non-fatal error handling prevents a buggy clustering run from blocking regime detection.

**Consequences**
- `INTELLIGENCE_*` env vars control each loop interval
- Loops use the same safe-runner pattern as Phase 9 stream processors

---

### ADR-038 — Phase 12 is READ-ONLY platform intelligence

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
All Phase 12 observability services (metrics-collector, service-health-engine, scheduler-monitor, strategy-health-engine, ai-health-engine, execution-health-engine, alert-engine, incident-manager) collect and surface data only. They never place orders, modify positions, or call any trading infrastructure.

**Rationale**
Observability must be a passive layer — a malfunctioning monitoring system must not interfere with capital-affecting components. The safety boundary is identical in intent to the Phase 8 (AI) and Phase 11 (intelligence) advisory-only boundaries.

**Consequences**
- Phase 12 services only read from Phase 1–11 DB tables; they never write to trading tables
- Route handlers under `/api/v1/ops/*` can acknowledge/resolve alerts and incidents (operational actions) but cannot trigger any execution path
- `replit.md` and `AGENTS.md` document this boundary for all future agents

---

### ADR-039 — Phase 12 ops-scheduler runs 10 independent non-fatal loops

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
`ops-scheduler.ts` runs 10 `setInterval` loops independently: system metrics (30s), service health (2m), alert evaluation (60s), scheduler snapshot (60s), stream snapshot (2m), strategy health (5m), AI health (15m), execution health (15m), incident scan (5m), performance snapshot (15m). Every loop is wrapped in a try/catch — exceptions are logged but never propagate.

**Rationale**
Monitoring loops must not cascade failures. A broken strategy-health evaluation should not prevent alert firing or system metrics collection. Cadences are chosen to balance freshness (metrics: 30s) against cost (strategy/AI/execution: 15m — these require cross-table aggregation).

**Consequences**
- Adding a new monitoring loop requires only a `setInterval` call in `startOpsScheduler()` — no structural changes
- Each loop calls a single service method; business logic stays in the service, not the scheduler

---

### ADR-040 — Incident auto-creation threshold is `emergency` severity only

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
`incident-manager.ts` automatically opens a new incident only when an alert event with severity `emergency` fires and no existing open incident is already linked to the same alert rule. `critical` and `warning` alerts create alert events but do not auto-open incidents.

**Rationale**
Auto-creating incidents on every `critical` alert would produce noise — many critical alerts self-resolve within minutes (e.g., a transient memory spike). Incidents represent sustained, human-attention-required situations. `emergency` is reserved for conditions that require immediate response (platform down, complete data loss) and always warrants an incident record.

**Consequences**
- Operators can manually link any alert event to an incident via the incident timeline API if they decide a `critical` alert warrants escalation
- Auto-resolution scan (`scanForAutoResolution`) closes incidents when all linked emergency alerts are resolved

---

### ADR-043 — Dashboard Framework: React + Vite + Tailwind v4 + shadcn + Wouter

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
The Phase 13 dashboard is built as a standalone pnpm workspace package (`artifacts/dashboard/`) using React 19, Vite, Tailwind CSS v4, shadcn/ui primitives, recharts for charts, and wouter for client-side routing.

**Context**
A frontend dashboard was needed to surface all 12 prior phases of data from the REST API in a unified operator console. The dashboard needed to be fully type-safe against the existing OpenAPI spec via `@workspace/api-client-react` Orval-generated hooks.

**Rationale**
- Vite provides near-instant HMR and ESM-native bundling — appropriate for a single-developer workspace.
- Tailwind v4 (using `@import "tw-animate-css"` not `tailwindcss-animate`) is the forward-compatible choice given the existing project dependency direction.
- Wouter is chosen over React Router because the dashboard has no server-side routing requirements and wouter's API is simpler for a single-operator console.
- Recharts is chosen over Victory/Nivo for bundle size and its declarative React API.
- `@workspace/api-client-react` Orval-generated hooks provide complete type coverage over the OpenAPI spec with React Query v5 caching.

**Alternatives Considered**
- Next.js — unnecessary SSR/SSG complexity for an internal operator console; adds build complexity.
- React Router v7 — heavier than wouter for a flat route tree with no dynamic segments.

**Consequences**
- Dashboard runs on port 5000 (separate from API on port 3000) to allow independent restarts.
- All query options use `as any` cast for the `queryKey` required field in Orval-generated `UseQueryOptions` — this is a known Orval v7 pattern; the queryKey is always provided by the generated `getXxxQueryOptions` function at runtime.
- `DataTable<T>` generic component is the primary data display primitive; its `cell` prop accepts `(item: T, index: number) => ReactNode` to enable rank columns.

---

### ADR-044 — Dashboard Uses No Mock Data

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
All 11 dashboard pages fetch exclusively from the live API server via `@workspace/api-client-react` hooks. No mock data, no static fixtures, no hardcoded fallback arrays beyond empty-state defaults.

**Rationale**
The platform's value is real-time operational awareness. A dashboard that renders fake data gives false confidence. Empty states ("No data", "Select a service") are acceptable and honest.

**Consequences**
- The dashboard requires the API server (`Start application` workflow) to be running to show non-empty content.
- Stale-while-revalidate and periodic `refetchInterval` (10–30s) ensures the operator always sees fresh data without manual refreshes.

---

### ADR-045 — argon2 for password hashing (not bcrypt)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Phase 14 uses `argon2` (argon2id variant) for password hashing, not `bcrypt` or `scrypt`.

**Rationale**
argon2id is the OWASP-recommended password hashing algorithm as of 2023. It provides memory-hardness (resistance to GPU/ASIC attacks) in addition to time-hardness. bcrypt is CPU-only and does not provide memory-hardness. The `argon2` npm package builds natively (added to `pnpm-workspace.yaml` `onlyBuiltDependencies`).

**Consequences**
- `argon2` must be in `onlyBuiltDependencies` in `pnpm-workspace.yaml` to trigger native build
- Password migration: if the system is seeded with bcrypt hashes from another source, they will need to be rehashed on next login

---

### ADR-046 — JWT access/refresh token pair with sliding refresh window

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Auth uses a two-token model: short-lived JWT access tokens (15m) + long-lived refresh tokens (7d/30d). Refresh tokens are stored hashed in `refresh_tokens` table and rotated on each use (one-time-use).

**Rationale**
Short-lived access tokens limit the blast radius of token theft — an intercepted token expires in 15 minutes. Refresh token rotation means a stolen refresh token is detected on next use (the legitimate user's request will fail because the token was already rotated). This is the industry-standard approach used by Auth0, Okta, and Supabase.

**Consequences**
- Clients must implement silent refresh (handled in `auth-client.ts` `apiFetch` wrapper)
- Refresh tokens older than 30d are invalid; users are logged out gracefully
- `ensureSuperAdminExists()` promotes the first registered user to super_admin on startup — this is safe because it only acts when no super_admin exists

---

### ADR-047 — RBAC permission model: resource:action strings

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Permissions are fine-grained strings in the format `resource:action` (e.g., `candles:read`, `users:write`, `operations:admin`). Roles are collections of permissions. Effective permissions are resolved at request time as the union of all permissions from all roles assigned to the user (optionally scoped to an org).

**Resources defined**: `candles`, `markets`, `providers`, `research`, `paper_trading`, `risk`, `analytics`, `ai`, `streams`, `execution`, `intelligence`, `operations`, `users`.
**Actions defined**: `read`, `write`, `delete`, `admin`.

**Rationale**
String-based permissions are more flexible than enum-based systems and easier to extend. The `resource:action` pattern mirrors AWS IAM and is immediately understandable. Super admins bypass all permission checks entirely.

**Consequences**
- Adding a new resource requires no schema migration — just add a new permission row
- `getUserEffectivePermissions(userId, orgId?)` resolves the full permission set; this is called on every `requirePermission` middleware invocation (cached in `req.auth` after first resolve)

---

### ADR-048 — express-rate-limit v8: no custom keyGenerator for IP-based limiting

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Rate limiters use express-rate-limit v8's built-in default `keyGenerator` rather than a custom function that reads `req.ip`.

**Rationale**
express-rate-limit v8 raises `ERR_ERL_KEY_GEN_IPV6` when a custom `keyGenerator` reads `req.ip` without using the `ipKeyGenerator` helper. The built-in default already handles IPv4/IPv6 normalization correctly. Using `limit` (v8 API) instead of `max` (v7 API) is required.

**Consequences**
- The built-in default uses `req.ip` internally with proper IPv6 handling
- Three rate limit tiers: `generalRateLimit` (200/15m), `authRateLimit` (20/15m), `strictRateLimit` (5/15m)

---

### ADR-049 — Multi-tenant via X-Organization-Id header (not subdomain)

**Date**: 2026-06-03
**Status**: Accepted
**Author**: AI agent

**Decision**
Tenant context is resolved from the `X-Organization-Id` HTTP header (set by the client after login) rather than subdomain-based routing or path-based routing.

**Rationale**
Subdomain routing requires DNS configuration per tenant and is impractical in a self-hosted Replit environment. Path-based routing (`/org/:id/...`) pollutes all URL structures. Header-based resolution is the simplest approach for an API-first SaaS with a single-domain deployment. The `resolveTenant` middleware populates `req.tenant` if the header is present and valid; routes can optionally require tenant context.

**Consequences**
- Frontend must set `X-Organization-Id` header after login when making org-scoped requests
- Existing pre-Phase-14 endpoints continue to work without the header (non-breaking)

---
### ADR-034 — Metadata-Only Backup Strategy (Phase 16)

**Date**: 2026-06-04
**Status**: Accepted
**Author**: AI agent

**Decision**
Implement database backup as a two-level system: (1) metadata backup — row counts and schema checksums recorded in `backup_runs` via `pg_stat_user_tables`; (2) restore validation — checksum, row-count variance, and schema presence checks via `restore_tests`. Full `pg_dump` binary backup is documented in `RUNBOOK.md` as a shell-level operation, not automated in-process.

**Context**
Replit's environment does not provide shell access to `pg_dump` within the Node.js process. Implementing full dump-level backup requires OS-level access documented as an operator runbook step.

**Rationale**
- Metadata backup provides continuous visibility into table health and row count trends at zero runtime overhead
- Restore test validates backup quality without requiring a production restore
- `pg_dump` documented in RUNBOOK.md (Section 8) for when shell access is available
- Audit log captures all backup operations immutably

**Consequences**
- Backup recovery requires shell access to `pg_restore` — not automatable from within the Node process
- Metadata snapshots are always available and provide early warning of data loss

**Review Trigger**
If shell-level DB access becomes available within the runtime, upgrade to full `pg_dump` automation.

---

### ADR-035 — Multi-Channel Notification Engine (Phase 16)

**Date**: 2026-06-04
**Status**: Accepted
**Author**: AI agent

**Decision**
Alert delivery routes to all active notification channels matching the alert severity. Channels support email, webhook, and Slack-compatible formats. Delivery history stored in `notification_deliveries`. Retry with exponential backoff (up to `maxRetries`, default 3). Cooldown period prevents alert storms.

**Context**
Phase 12's alert engine fires alert events but had no delivery mechanism to external endpoints. Ops teams need multi-channel delivery with guaranteed delivery tracking.

**Rationale**
- Fan-out to all matching channels ensures no delivery path is single-point-of-failure
- Cooldown per channel prevents duplicate delivery during sustained alert conditions
- Delivery history enables audit and delivery rate monitoring
- Slack Block Kit format enables rich alert presentation without a dedicated Slack SDK

**Consequences**
- All deliveries are async (fire-and-forget from the alert engine perspective)
- Failed deliveries are recorded but do not block alert processing
- Channel configuration is DB-backed — changes take effect without server restart

---

### ADR-036 — Layered Health Check Endpoints (Phase 16)

**Date**: 2026-06-04
**Status**: Accepted
**Author**: AI agent

**Decision**
Three health endpoints at different abstraction levels:
- `/health/live` — pure liveness (no external deps, instant response)
- `/health/ready` — readiness (DB ping + event loop lag + memory pressure)
- `/health/dependencies` — full dependency inventory (all providers, billing, memory, event loop)

Legacy `/healthz` preserved unchanged for backward compatibility.

**Context**
Kubernetes-style health probes require separate liveness and readiness checks. Load balancers and monitoring systems expect these on standard paths.

**Rationale**
- Liveness probe must not check external deps (a DB outage should not kill the process)
- Readiness probe uses strict thresholds (DB error = not ready; high memory = not ready)
- Dependency probe is slow-path diagnostic — not suitable for high-frequency polling
- Three-tier design matches Kubernetes `livenessProbe` / `readinessProbe` / startup documentation standard

**Consequences**
- Liveness is always fast (< 1ms) — suitable for 15s poll intervals
- Readiness adds DB ping (~2–50ms) — suitable for 30s poll intervals
- Dependencies adds multiple checks (~10–100ms) — suitable for manual/monitoring use only

---

### ADR-037 — In-Memory Latency Profiler with Rolling Window (Phase 16)

**Date**: 2026-06-04
**Status**: Accepted
**Author**: AI agent

**Decision**
Track API and DB latency in a 5-minute rolling in-memory window. Compute p50/p95/p99 from sorted samples. Take snapshots every 5 minutes (up to 288 — 24h of history). Expose via `/api/v1/ops/profiling`. No external APM dependency.

**Context**
Production performance visibility requires latency percentile data. APM tools (Datadog, New Relic) are heavyweight for a personal trading platform.

**Rationale**
- In-memory rolling window is zero-dependency, zero-cost, and available immediately
- 5-minute window matches common monitoring intervals
- p50/p95/p99 is sufficient for identifying hot endpoints
- Snapshots stored in-memory (not DB) — profiling data is not durable, which is acceptable for live debugging

**Consequences**
- Profiling history is lost on server restart (by design — use system_metrics table for durable history)
- Memory footprint: 10,000 samples × ~50 bytes = 500KB max per metric type (trivial)
- Does not replace production APM for high-traffic deployments

---

### ADR-038 — CI Pipeline with Security Gate (Phase 16)

**Date**: 2026-06-04
**Status**: Accepted
**Author**: AI agent

**Decision**
GitHub Actions CI pipeline with 5 jobs: typecheck (blocking), build (blocking), OpenAPI validation (blocking), security audit (non-blocking, `continue-on-error: true`), lint (non-blocking). Release pipeline gates on typecheck + build before creating GitHub release.

**Context**
No CI pipeline existed before Phase 16. Code quality enforcement was manual.

**Rationale**
- Typecheck and build must block — a TypeScript error or build failure must never reach main
- OpenAPI validation blocks — broken API spec breaks code generation downstream
- Security audit is non-blocking (`continue-on-error: true`) — audit warnings should not block hotfixes during incidents
- Lint is non-blocking — formatting is developer preference, not a correctness gate
- `cancel-in-progress: true` prevents queue buildup on rapid pushes
- `--frozen-lockfile` in all install steps prevents dependency drift

**Consequences**
- PRs with TypeScript errors are blocked automatically
- Security audit runs on every push — supply-chain issues surface immediately
- Release process is two-stage: CI on push, release creation on tag push only
