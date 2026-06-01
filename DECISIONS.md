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
