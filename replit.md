# QuantForge

A personal quantitative trading platform — ingests multi-market OHLCV data from provider abstractions, runs data quality checks, exposes a REST API for querying candles, providers, economic events, and news, and is now a fully production-hardened SaaS product with Stripe billing, plan management, usage metering, revenue analytics, backup/recovery automation, multi-channel alert delivery, security auditing, performance profiling, and CI/CD pipeline.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080 → proxied at `/api`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `SESSION_SECRET`
- Optional env (billing): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_YEARLY`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_YEARLY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9 (strict)
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → `lib/api-spec`)
- Build: esbuild (ESM bundle)
- Logging: pino + pino-http
- Billing: Stripe SDK (graceful offline mode when `STRIPE_SECRET_KEY` is unset)

## Where things live

- `lib/db/src/schema/` — source-of-truth for all DB tables (Drizzle)
- `lib/api-spec/openapi.yaml` — source-of-truth for all API contracts
- `artifacts/api-server/src/routes/v1/` — one file per endpoint group
- `artifacts/api-server/src/services/` — business logic layer
- `artifacts/api-server/src/providers/` — market data provider abstraction
- `artifacts/api-server/src/ingestion/scheduler.ts` — background scheduler (ingestion, health, quality)
- `artifacts/api-server/src/services/billing-types.ts` — plan definitions, quota definitions, billing type defs
- `artifacts/api-server/src/services/billing-db.ts` — raw CRUD for all 9 billing tables
- `artifacts/api-server/src/services/stripe-client.ts` — Stripe SDK wrapper (lazy singleton, offline-safe)
- `artifacts/api-server/src/services/subscription-service.ts` — plan seeding, changePlan, cancelSubscription
- `artifacts/api-server/src/services/usage-service.ts` — recordUsage, checkQuota, getOrgUsageSummary
- `artifacts/api-server/src/services/invoice-service.ts` — Stripe invoice sync + event handling
- `artifacts/api-server/src/services/revenue-analytics-service.ts` — MRR/ARR/churn/expansion metrics
- `artifacts/api-server/src/middleware/plan-middleware.ts` — requirePlan, enforceQuota, trackUsage
- `artifacts/dashboard/src/lib/billing-client.ts` — typed fetch wrapper for all billing endpoints
- `artifacts/dashboard/src/pages/billing.tsx` — plan management, usage meters, revenue analytics
- `artifacts/dashboard/src/pages/billing-invoices.tsx` — invoice history + Stripe PDF download
- `artifacts/dashboard/src/pages/billing-payment-methods.tsx` — saved card management
- `artifacts/api-server/src/services/backup-service.ts` — metadata backup execution (row counts, checksums)
- `artifacts/api-server/src/services/restore-service.ts` — restore test validation (checksum, row-count, schema)
- `artifacts/api-server/src/services/backup-scheduler.ts` — 5-min backup polling + 6-hr restore test loop
- `artifacts/api-server/src/services/notification-engine.ts` — multi-channel alert fan-out (webhook, Slack, email)
- `artifacts/api-server/src/services/webhook-provider.ts` — HTTP webhook + Slack Block Kit delivery
- `artifacts/api-server/src/services/security-audit-service.ts` — 19-control runtime security posture (5-min cache)
- `artifacts/api-server/src/services/performance-profiler.ts` — in-memory p50/p95/p99 latency, 5-min snapshots
- `artifacts/dashboard/src/pages/production-status.tsx` — server health, security audit, backup, performance, alerts

## Architecture decisions

- **Contract-first API**: OpenAPI spec → Orval codegen → Zod validators used in route handlers. Never write validation schemas by hand.
- **Provider abstraction**: All market data flows through `IMarketDataProvider` interface. `ProviderRegistry` is a singleton; Binance is active, others are stubs.
- **Two ingestion tables**: `ingestion_logs` (Phase 1, lightweight) kept for backward compat; `ingestion_jobs` (Phase 2) is the richer tracking table.
- **Scheduler runs three loops**: ingestion every 5 min, health checks every 2 min, quality checks every 1 hr.
- **DB seeding on startup**: markets, providers, strategy definitions, risk profiles, benchmarks, RBAC roles/permissions, and billing plans are all upserted on every server start.
- **Billing is per-organization**: org context resolved from `req.auth.organizationId` or `req.tenant.organizationId`.
- **Stripe offline mode**: When `STRIPE_SECRET_KEY` is unset, all Stripe calls return null gracefully. Plan/quota logic works entirely from DB.
- **Feature gating via DB**: Subscription state stored in DB; Stripe is payment authority, DB is feature-gate authority. `enforceQuota` is non-blocking in dev, hard-blocking in prod.
- **Webhook raw body**: `/api/v1/billing/webhook` uses `express.raw()` registered before `express.json()` in `app.ts`.
- **Health probes mount under `/api`**: All health routes are under `/api/health/*` (`/api/health/live`, `/api/health/ready`, `/api/health/dependencies`). They are NOT at root level — the router mounts at `app.use("/api", router)`.
- **Backup is metadata-only in-process**: `backup-service.ts` records row counts and checksums via `pg_stat_user_tables`. Full `pg_dump` requires shell access — documented in `RUNBOOK.md` Section 8.
- **Profiler is in-memory only**: `performance-profiler.ts` stores rolling windows in JS arrays — data does not survive restarts. For durable history use Phase 12 `system_metrics` table.
- **Security audit cached 5 min**: `POST /api/v1/ops/security-audit/refresh` forces a fresh run. Never set cache TTL < 60s (audit makes DB queries).

## Product

Phase 1: Binance OHLCV ingestion for BTC/ETH/SOL/BNB, candles/markets/ingestion REST endpoints.
Phase 2: Provider health monitoring, data quality framework (gap/dupe/stale/volume/coverage checks), ingestion job tracking, economic calendar schema, news schema, market metadata, provider registry — 7 new DB tables, 7 new endpoint groups.
Phase 3–13: Strategy framework, backtesting, paper trading, risk engine, analytics, AI research assistant, streaming infrastructure, order management system, intelligence layer, observability/ops platform, multi-tenant auth/RBAC/security.
Phase 14: Authentication, RBAC, multi-tenant SaaS & security foundation — JWT auth, sessions, API keys, org management, role/permission model, audit log, security events.
Phase 15: Billing, Subscriptions & SaaS Commercialization — Stripe integration, 4-tier plan management (Free/Pro/Team/Enterprise), usage metering, customer portal, invoice management, revenue analytics (MRR/ARR/churn), plan middleware for feature gating — 9 new DB tables, 9 new endpoint groups, 3 new frontend pages.
Phase 16: Production Readiness & Hardening — security audit (19 controls, 88/100 score), metadata backup/recovery system, multi-channel alert delivery (webhook/Slack/email), layered health probes (live/ready/dependencies), in-process performance profiling (p50/p95/p99), load testing suite, CI/CD pipeline (GitHub Actions), DEPLOYMENT.md + RUNBOOK.md, Production Status dashboard page — 6 new DB tables, 5 new route groups.

## REST Endpoints

| Path | Description |
|------|-------------|
| `GET /api/healthz` | Health check |
| `GET /api/v1/markets` | List markets |
| `GET /api/v1/candles` | OHLCV candles |
| `GET /api/v1/latest-price` | Latest price |
| `GET /api/v1/ingestion/status` | Ingestion log status |
| `GET /api/v1/ingestion/jobs` | Ingestion job history |
| `GET /api/v1/providers` | List providers |
| `GET /api/v1/providers/health` | Provider health history |
| `GET /api/v1/market-registry` | Markets with provider + metadata |
| `GET /api/v1/data-quality` | Quality check results |
| `GET /api/v1/economic-events` | Economic calendar |
| `GET /api/v1/news` | News items |
| `GET /api/v1/billing/plans` | List billing plans |
| `GET /api/v1/billing/subscription` | Current org subscription |
| `POST /api/v1/billing/subscription` | Create subscription |
| `PATCH /api/v1/billing/subscription` | Change plan |
| `DELETE /api/v1/billing/subscription` | Cancel subscription |
| `GET /api/v1/billing/customer` | Billing customer record |
| `POST /api/v1/billing/customer/sync` | Create/sync Stripe customer |
| `GET /api/v1/billing/payment-methods` | List saved cards |
| `DELETE /api/v1/billing/payment-methods/:id` | Remove card |
| `PATCH /api/v1/billing/payment-methods/:id/default` | Set default card |
| `GET /api/v1/billing/invoices` | Invoice history |
| `GET /api/v1/billing/invoices/:id` | Single invoice |
| `GET /api/v1/billing/usage` | Current period usage summary |
| `POST /api/v1/billing/usage/record` | Record usage event |
| `POST /api/v1/billing/portal/session` | Create Stripe customer portal session |
| `GET /api/v1/billing/revenue` | Revenue metrics (admin) |
| `GET /api/v1/billing/revenue/history` | Historical revenue snapshots (admin) |
| `POST /api/v1/billing/revenue/snapshot` | Force revenue snapshot (admin) |
| `GET /api/v1/billing/events` | Billing event audit log (admin) |
| `POST /api/v1/billing/webhook` | Stripe webhook (raw body) |
| `GET /api/health/live` | Liveness probe (no external deps) |
| `GET /api/health/ready` | Readiness probe (DB + memory + event loop) |
| `GET /api/health/dependencies` | Per-component dependency health |
| `GET /api/v1/ops/backups` | Backup job list |
| `POST /api/v1/ops/backups/:id/run` | Trigger manual backup |
| `GET /api/v1/ops/backups/:id/runs` | Backup run history |
| `GET /api/v1/ops/recovery` | Restore test history |
| `POST /api/v1/ops/recovery/test` | Run on-demand restore test |
| `GET /api/v1/ops/notification-channels` | Notification channel list + 24h stats |
| `POST /api/v1/ops/notification-channels` | Create notification channel |
| `GET /api/v1/ops/notification-channels/:id/deliveries` | Delivery history |
| `GET /api/v1/ops/security-audit` | Runtime security posture (cached 5 min) |
| `POST /api/v1/ops/security-audit/refresh` | Force fresh security audit |
| `GET /api/v1/ops/profiling` | Current performance snapshot |
| `GET /api/v1/ops/profiling/snapshots` | Snapshot history (up to 288 = 24h) |
| `POST /api/v1/ops/profiling/snapshot` | Force immediate snapshot |

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- **Always add new route groups to `routes/index.ts`** — v1Router is mounted there with `router.use("/v1", v1Router)`. Forgetting this mount silently breaks ALL `/api/v1/*` routes.
- **All imports in service files must be at the top of the file** — esbuild may mishandle non-top-level `import` statements, causing silent bundling failures.
- `lib/db/package.json` exports point to TypeScript source (`./src/index.ts`), not `dist/`. esbuild resolves workspace packages directly to TS source.
- When adding new DB tables, export them from `lib/db/src/schema/index.ts` AND re-run `pnpm --filter @workspace/api-spec run codegen` to rebuild the compiled declarations.
- **`usage_quotas` needs a unique index on `(plan_slug, resource_type)`** for the upsert's `ON CONFLICT` clause to work. The index is `usage_quotas_plan_resource_uidx`. If missing, `seedBillingPlans()` will error at startup.
- **Stripe webhook requires raw body** — `express.raw({ type: "application/json" })` is mounted at `/api/v1/billing/webhook` before `express.json()` in `app.ts`. Do not reorder these middlewares.
- **Stripe API version** — must match the version string in the installed `stripe` npm package. Current: `"2026-05-27.dahlia"`. Mismatches cause a TS2322 at compile time.
- **`db.execute()` returns QueryResult, not array** — Drizzle's `db.execute()` with node-postgres returns `{ rows: [...] }`, not a plain array. Always extract with `(result as any).rows ?? result` before iterating.
- **Dashboard frontend routes** — home is `/`, not `/dashboard`. Full route list: `/`, `/operations`, `/service-health`, `/alerts`, `/incidents`, `/portfolio`, `/strategy-rankings`, `/risk`, `/execution`, `/streaming`, `/ai-insights`, `/profile`, `/security`, `/users`, `/org-settings`, `/billing`, `/billing/invoices`, `/billing/payment-methods`, `/production-status`.
- **Backup trigger path** — correct path is `POST /api/v1/ops/backups/:id/run`, not `/trigger`.
- **Profiling history path** — correct path is `GET /api/v1/ops/profiling/snapshots`, not `/history`.
- **Browser preview port conflict** — if "Component Preview Server" appears instead of the dashboard, the mockup-sandbox artifact (port 8081) is competing for externalPort 80. Fix by calling `configureWorkflow` for the Dashboard to reassert port 5000 as the exclusive webview.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
