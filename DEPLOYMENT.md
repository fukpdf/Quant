# DEPLOYMENT.md — QuantForge Deployment Guide

> Production deployment reference. Read before every production deploy.

---

## Pre-Deployment Checklist

### Environment Validation

- [ ] `DATABASE_URL` is set and points to a production PostgreSQL instance
- [ ] `JWT_SECRET` is set (min 32 chars, random, rotated from dev secret)
- [ ] `ENCRYPTION_KEY` is set (min 32 chars, random, rotated from dev secret)
- [ ] `SESSION_SECRET` is set (min 32 chars, random)
- [ ] `NODE_ENV=production` is set
- [ ] `PORT` is set to the desired listen port
- [ ] `LOG_LEVEL=info` (or `warn` in production)
- [ ] `EXECUTION_MODE` is set to `simulation` or `paper` (never `live`)
- [ ] `AI_PROVIDER` is set (`mock` unless OpenAI/Anthropic is configured)
- [ ] `BILLING_MODE` is set (`offline` unless Stripe is configured)

### Database

- [ ] Run `pnpm --filter @workspace/db run push` to apply all schema migrations
- [ ] Verify all tables exist via `psql` or database admin tool
- [ ] Confirm last backup completed successfully before deploying
- [ ] Confirm restore test passed for the last backup

### Build

- [ ] Run `pnpm install --frozen-lockfile` (never plain `pnpm install` in CI)
- [ ] Run `pnpm run typecheck` — must pass with zero errors
- [ ] Run `pnpm --filter @workspace/api-server run build`
- [ ] Run `pnpm --filter @workspace/dashboard run build`
- [ ] Confirm `dist/index.mjs` was produced

### Security

- [ ] No secrets in any `.env` file committed to git
- [ ] No `console.log` calls in production paths
- [ ] HSTS header enabled (`NODE_ENV=production` triggers it automatically)
- [ ] Rate limiting is active (default: 100 req/min per IP)
- [ ] Stripe webhook secret is set if Stripe is configured

---

## Startup Sequence

The API server performs these steps on startup in order:

1. Validate `PORT` environment variable
2. Start Express application with security headers, rate limiting, auth middleware
3. Seed markets (idempotent upsert of 7 default markets)
4. Seed provider registry (idempotent upsert of 4 providers)
5. Seed strategy definitions (idempotent upsert of 4 strategies)
6. Start Phase 1–2 ingestion scheduler (5 min cycle)
7. Start Phase 5 paper trading scheduler
8. Start Phase 6 risk scheduler
9. Seed default benchmarks
10. Start Phase 7 analytics scheduler
11. Initialize AI provider (mock by default)
12. Start Phase 9 streaming infrastructure (non-fatal)
13. Start Phase 10 execution infrastructure (simulation mode)
14. Start Phase 11 intelligence scheduler
15. Start Phase 12 ops scheduler
16. Seed RBAC roles and permissions
17. Ensure super admin exists (promotes first registered user)
18. Seed billing plans

**Database migrations must run before step 1.**

---

## Health Endpoints

After deployment, verify all health endpoints respond correctly:

```bash
# Basic liveness check
curl https://<your-domain>/health/live
# Expected: {"status":"alive","timestamp":"..."}

# Readiness check (DB must be connected)
curl https://<your-domain>/health/ready
# Expected: {"status":"ready","checks":{"database":"ok",...}}

# Dependency health
curl https://<your-domain>/health/dependencies
# Expected: {"status":"healthy","dependencies":{...}}

# Legacy health endpoint
curl https://<your-domain>/api/healthz
# Expected: {"status":"ok"}
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string |
| `JWT_SECRET` | **Yes** | — | JWT signing secret (min 32 chars) |
| `ENCRYPTION_KEY` | **Yes** | — | Column encryption key (min 32 chars) |
| `SESSION_SECRET` | **Yes** | — | Express session secret |
| `PORT` | **Yes** | — | API server listen port |
| `NODE_ENV` | **Yes** | `development` | `production` in prod |
| `LOG_LEVEL` | No | `info` | `debug\|info\|warn\|error` |
| `AI_PROVIDER` | No | `mock` | `mock\|openai\|anthropic\|gemini` |
| `OPENAI_API_KEY` | No | — | Required when `AI_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | No | — | Required when `AI_PROVIDER=anthropic` |
| `EXECUTION_MODE` | No | `simulation` | `simulation\|paper\|live_disabled` |
| `EXECUTION_ENABLED` | No | `true` | Set `false` to disable OMS |
| `STREAM_PROVIDER` | No | `mock` | `mock\|binance` |
| `STREAM_ENABLED` | No | `true` | Set `false` to disable streaming |
| `BILLING_MODE` | No | `offline` | `offline\|live` |
| `STRIPE_SECRET_KEY` | No | — | Required when `BILLING_MODE=live` |
| `STRIPE_WEBHOOK_SECRET` | No | — | Required for Stripe webhook verification |
| `EMAIL_PROVIDER` | No | `console` | `console\|smtp` |
| `SMTP_HOST` | No | — | Required when `EMAIL_PROVIDER=smtp` |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `CORS_ORIGIN` | No | `true` | CORS allowed origin (restrict in prod) |

---

## Rollback Procedure

If a deployment fails or causes production issues:

1. **Identify the issue** — check `/health/ready` and API logs
2. **Immediate rollback** — redeploy the previous tagged release
3. **Schema rollback** — if DB schema changed, restore from backup (see RUNBOOK.md)
4. **Verify rollback** — confirm `/health/ready` returns `status: "ready"`
5. **Post-mortem** — document incident in DECISIONS.md

---

## Release Tagging

All production releases are tagged using semantic versioning:

```bash
git tag -a v0.16.0 -m "Phase 15 — Production Readiness"
git push origin v0.16.0
```

The GitHub Actions release workflow triggers automatically on tag push.

---

## Replit Deployment

For Replit Autoscale deployment:

1. Click "Deploy" in the Replit workspace
2. Replit runs `pnpm --filter @workspace/api-server run build` as the build step
3. Production process runs `node --enable-source-maps dist/index.mjs`
4. All environment variables must be set in Replit Secrets (Shared environment)
5. `DATABASE_URL` is automatically injected by the Replit PostgreSQL integration

See [docs/10-IMPLEMENTATION_PLAN.md](./docs/10-IMPLEMENTATION_PLAN.md) for infrastructure details.
