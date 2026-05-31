# QuantForge

A personal quantitative trading platform — ingests multi-market OHLCV data from provider abstractions, runs data quality checks, and exposes a REST API for querying candles, providers, economic events, and news.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 → proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9 (strict)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → `lib/api-spec`)
- Build: esbuild (ESM bundle)
- Logging: pino + pino-http

## Where things live

- `lib/db/src/schema/` — source-of-truth for all DB tables (Drizzle)
- `lib/api-spec/openapi.yaml` — source-of-truth for all API contracts
- `artifacts/api-server/src/routes/v1/` — one file per endpoint group
- `artifacts/api-server/src/services/` — business logic layer
- `artifacts/api-server/src/providers/` — market data provider abstraction
- `artifacts/api-server/src/ingestion/scheduler.ts` — background scheduler (ingestion, health, quality)

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → Zod validators used in route handlers. Never write validation schemas by hand.
- **Provider abstraction**: All market data flows through `IMarketDataProvider` interface. `ProviderRegistry` is a singleton; Binance is active, others are stubs.
- **Two ingestion tables**: `ingestion_logs` (Phase 1, lightweight) kept for backward compat; `ingestion_jobs` (Phase 2) is the richer tracking table.
- **Scheduler runs three loops**: ingestion every 5 min, health checks every 2 min, quality checks every 1 hr.
- **DB seeding on startup**: markets and providers are upserted on every server start so new config is automatically reflected.

## Product

Phase 1: Binance OHLCV ingestion for BTC/ETH/SOL/BNB, candles/markets/ingestion REST endpoints.
Phase 2: Provider health monitoring, data quality framework (gap/dupe/stale/volume/coverage checks), ingestion job tracking, economic calendar schema, news schema, market metadata, provider registry — 7 new DB tables, 7 new endpoint groups.

## REST Endpoints

| Path | Description |
|------|-------------|
| `GET /api/healthz` | Health check |
| `GET /api/v1/markets` | List markets (filter: `type`, `active`) |
| `GET /api/v1/candles` | OHLCV candles (filter: `symbol`, `interval`, `limit`, `from`, `to`) |
| `GET /api/v1/latest-price` | Latest price for a symbol |
| `GET /api/v1/ingestion/status` | Ingestion log status |
| `GET /api/v1/ingestion/jobs` | Ingestion job history |
| `GET /api/v1/providers` | List market data providers |
| `GET /api/v1/providers/health` | Provider health history |
| `GET /api/v1/market-registry` | Markets with provider + metadata join |
| `GET /api/v1/data-quality` | Data quality check results |
| `GET /api/v1/data-quality/report` | Aggregate quality report |
| `GET /api/v1/economic-events` | Economic calendar events |
| `GET /api/v1/news` | News items |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Always add new route groups to `routes/index.ts`** — v1Router is mounted there with `router.use("/v1", v1Router)`. Forgetting this mount silently breaks ALL `/api/v1/*` routes.
- **All imports in service files must be at the top of the file** — esbuild may mishandle non-top-level `import` statements, causing silent bundling failures.
- `lib/db/package.json` exports point to TypeScript source (`./src/index.ts`), not `dist/`. esbuild resolves workspace packages directly to TS source.
- When adding new DB tables, export them from `lib/db/src/schema/index.ts` AND re-run `pnpm --filter @workspace/api-spec run codegen` to rebuild the compiled declarations.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
