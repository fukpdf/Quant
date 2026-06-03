# AGENTS.md — AI Agent Operating Instructions

> **ALL AI agents (Replit Agent, Claude, Gemini, GPT, Cursor, Copilot, etc.) MUST read this file before writing any code or modifying any file in this repository.**

---

## What Is This Project?

QuantForge is a personal quantitative trading platform. It is built in phases. Each phase builds on the previous. No phase is skipped. No feature is implemented before its phase is reached.

Read [PROJECT_MASTER.md](./PROJECT_MASTER.md) for the full project brain.

---

## Mandatory Pre-Coding Protocol

Before writing a single line of code, every AI agent MUST:

### Step 1 — Read PROJECT_MASTER.md
Understand:
- The vision and long-term goals
- Current phase
- Architecture principles
- Security requirements
- Development principles

### Step 2 — Read TODO.md
Understand:
- What has been completed
- What is in progress
- What is planned for future phases
- What is explicitly out of scope for the current phase

### Step 3 — Read CHANGELOG.md
Understand:
- What changed recently
- What was added, modified, or removed
- Current state of the codebase

### Step 4 — Read DECISIONS.md
Understand:
- Architecture decisions already made
- Why those decisions were made
- What alternatives were rejected
- Do not re-litigate closed decisions without strong justification

---

## Mandatory Post-Coding Protocol

After completing any code change, every AI agent MUST:

### Step 1 — Update TODO.md
- Mark completed tasks with `[x]`
- Add any new tasks discovered during implementation
- Move completed items to the correct "Completed" section

### Step 2 — Update CHANGELOG.md
- Add an entry under the correct section (Added / Changed / Fixed / Removed)
- Use the format defined in CHANGELOG.md
- Be specific — describe what changed and why

### Step 3 — Update Relevant Documentation
- If a new API endpoint was added → update docs/09-API_STRATEGY.md
- If the database schema changed → update docs/05-DATABASE_ARCHITECTURE.md
- If a new component was added → update the relevant docs section
- If an architecture decision was made → add it to DECISIONS.md

### Step 4 — Security Check
- Verify no secrets, API keys, passwords, or tokens are present in any file
- Verify no real values appear in .env.example
- Verify no credentials are logged to console

---

## Hard Rules — Never Violate These

| Rule | Explanation |
|------|-------------|
| Never expose secrets | No API keys, passwords, tokens, or credentials in any file |
| Never remove working functionality | Do not delete or disable code that is currently in use |
| Never skip phases | Do not implement Phase 3 features during Phase 1 |
| Never deploy directly to production | All deployments go through the defined workflow |
| Never use hardcoded values for configuration | All config lives in environment variables |
| Never break the OpenAPI contract | The API spec is the source of truth; client and server must match |
| Never commit to main directly | (When GitHub CI is set up) All changes via pull request |

---

## Architecture Rules

### API Development
1. Write the OpenAPI spec FIRST (`lib/api-spec/openapi.yaml`)
2. Run codegen BEFORE writing frontend or backend code
3. Backend validates inputs using generated Zod schemas
4. Frontend uses generated React Query hooks
5. No hand-rolled fetch calls — always use generated hooks

### Database
1. All schema changes go in `lib/db/src/schema/`
2. Run `pnpm --filter @workspace/db run push` to apply changes in dev
3. Every schema change must be documented in docs/05-DATABASE_ARCHITECTURE.md
4. Never modify data directly in production without a migration script

### Frontend
1. All routes use the artifact's `previewPath` as a prefix
2. No hardcoded API URLs — use environment variables or generated base URL
3. Do not import from relative paths when a workspace package is available

### Security
1. Read SECURITY.md before implementing any feature that touches credentials, user data, or external APIs
2. All sensitive operations must be logged (actor, timestamp, action, result)
3. Any new environment variable must be added to .env.example with a comment explaining it

---

## Phase Awareness

The project is currently in **Phase 14 — Authentication, RBAC, Multi-Tenant SaaS & Security Foundation** (complete).
Next: **Phase 5 — Paper Trading**.

### What AI agents MAY do in Phase 4 / Phase 5:
- Add or extend strategy implementations
- Improve backtesting engine accuracy (cost models, fill models)
- Add indicator library functions
- Add or modify research API endpoints
- Extend performance metrics and validation checks
- Write tests for strategies and the engine
- Implement paper trading simulation (virtual account, simulated fills — no real capital)
- Implement virtual order management and position tracking for paper trading

### What AI agents MUST NOT do until Phase 6+:
- Implement live trading against real capital
- Implement real broker connectivity
- Implement risk engine enforcement on real orders
- Implement portfolio management for live money

### Key Phase 4 Architecture Notes (read before extending):
- Cost models and position sizing profiles are **research-only** — they size simulated positions, not real capital (ADR-010)
- Monte Carlo uses trade shuffling (bootstrap), not price-path simulation (ADR-011)
- Equity curves are stored as compact JSONB (`{ t, e, d }`), not row-per-point (ADR-012)
- Validation engine requires `ComputedMetrics` (number fields) — not DB numeric strings; callers must convert
- Walk-forward and Monte Carlo routes are async-like but run synchronously in-process (no job queue yet)
- All 10 Phase 4 endpoints are mounted under `/v1/research/` prefix via `routes/v1/index.ts`

### Key Phase 12 Architecture Notes (read before extending):
- All Phase 12 services are **READ-ONLY platform intelligence** — no trades, orders, or positions are affected (ADR-038)
- `ops-scheduler.ts` runs 10 independent non-fatal background loops; errors are logged but do not crash the scheduler (ADR-039)
- Alert engine seeds 12 built-in rules on startup via `upsertAlertRule`; adding new rules requires adding them to the `DEFAULT_ALERT_RULES` array in `alert-engine.ts`
- All Phase 12 DB access goes through `ops-db.ts` — never import Phase 12 tables directly in route files
- Incident auto-creation fires only on `emergency` severity alerts; `warning` and `critical` alerts create events but not incidents (ADR-040)
- `GET /api/v1/ops/system-metrics/live` reads in-memory from `MetricsCollector` — no DB round-trip; use for dashboards requiring sub-second freshness
- `GET /api/v1/ops/schedulers/live` reads in-memory from `SchedulerMonitor` — returns raw loop states, not DB snapshots
- 29 endpoints under `/api/v1/ops/*`; OpenAPI version: 0.12.0; codegen regenerated after spec update

### Key Phase 11 Architecture Notes (read before extending):
- All Phase 11 services are **advisory-only** — no live capital, no order placement (ADR-034)
- Regime detection uses a 6-indicator heuristic ensemble; minimum 20 candles required (ADR-035)
- Optimizer methods share one config/DB schema; `BacktestRequest` uses `interval` not `timeframe`, `params` not `parameters` (ADR-036)
- Intelligence Scheduler has 5 independent non-fatal loops — errors logged but don't crash (ADR-037)
- DB import: use `@workspace/db` (not `@workspace/db/client` — `/client` subpath is not exported)
- Column names: `totalTrades` (not `tradeCount`), `consistencyScore` (not `efficiencyRatio`), `medianReturn` (not `medianFinalEquity`), `timestamp` on candles (not `openTime`)
- All Phase 11 DB access goes through `intelligence-db.ts` — never import intelligence tables directly in services
- 17 endpoints under `/api/v1/intelligence/*` (rankings, regimes, allocations, optimization, generations, tasks, research)
- OpenAPI version: 0.11.0; codegen regenerated after spec update

---

## How to Determine What Phase Allows

Check TODO.md. Each phase has explicit task checklists. If a task is not in the current phase's checklist, it is out of scope. Ask for clarification before implementing it.

---

## Coding Standards

- Language: TypeScript (strict mode)
- Style: Follow existing patterns in the codebase
- Imports: Workspace packages use `@workspace/` prefix
- Logging: Use `req.log` in route handlers, `logger` singleton elsewhere — never `console.log` in server code
- Error handling: All async functions must handle errors explicitly — no swallowed exceptions
- Comments: Explain WHY, not WHAT. The code explains what; comments explain intent.

---

## When in Doubt

1. Read the relevant documentation file
2. Check DECISIONS.md for prior decisions
3. Add a comment in the code explaining the uncertainty
4. Update DECISIONS.md with the decision you made and why

Do not guess. Do not assume. Do not implement what is not explicitly in scope.

---

## Summary Checklist

```
Before coding:
[ ] Read PROJECT_MASTER.md
[ ] Read TODO.md
[ ] Read CHANGELOG.md
[ ] Read DECISIONS.md

After coding:
[ ] Updated TODO.md
[ ] Updated CHANGELOG.md
[ ] Updated relevant docs
[ ] No secrets in any file
[ ] No functionality removed
[ ] Architecture rules followed
[ ] Phase scope respected
```
