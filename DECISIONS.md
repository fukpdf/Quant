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
