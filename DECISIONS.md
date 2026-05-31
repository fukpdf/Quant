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
