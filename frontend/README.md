# /frontend — Web Dashboard

> Status: Not yet implemented. Planned for Phase 1.

---

## Purpose

The frontend is the web-based dashboard for monitoring market data, managing strategies, running backtests, reviewing portfolio analytics, and monitoring paper and live trading activity.

It is a React + Vite single-page application that communicates exclusively with the API server via generated React Query hooks.

---

## Technology

| Layer | Technology |
|-------|-----------|
| Framework | React 19 |
| Build | Vite 6 |
| Language | TypeScript (strict) |
| API Client | Orval-generated React Query hooks (`@workspace/api-client-react`) |
| Component Library | shadcn/ui + Tailwind CSS |
| State Management | React Query (server state) + React Context (UI state) |

---

## When This Gets Built

Phase 1 will introduce a basic frontend for:
- Market data feed status monitoring
- OHLCV chart viewer
- Asset catalog browser

Richer features follow in later phases.

---

## Workspace Package

When created: `@workspace/frontend`
Location: `artifacts/frontend/`
Preview path: `/` (root)

---

## For AI Agents

Before implementing any frontend feature:
1. Read [AGENTS.md](../AGENTS.md)
2. Verify the OpenAPI spec has been updated for new endpoints
3. Run codegen: `pnpm --filter @workspace/api-spec run codegen`
4. Import only from `@workspace/api-client-react` — never write raw fetch calls
5. Check that the current phase includes this feature in TODO.md

---

## Key Rules

- No hardcoded API URLs — use generated base URL
- No `console.log` in production code
- All data-fetching components handle loading, error, and empty states
- No emojis in UI unless explicitly requested
- Use generated React Query hooks — never `fetch()` directly
