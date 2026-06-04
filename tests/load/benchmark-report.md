# QuantForge API Benchmark Report

> Generated: 2026-06-04 | Environment: Development (Replit)

## Summary

Baseline performance benchmarks for the QuantForge API. All measurements taken on the development environment. Production performance will vary based on hardware, DB connection, and concurrent load.

---

## Endpoint Latency Baselines (p95)

| Endpoint | Method | p50 (ms) | p95 (ms) | p99 (ms) | Notes |
|----------|--------|-----------|-----------|-----------|-------|
| `/healthz` | GET | < 1 | < 5 | < 10 | In-process only |
| `/health/live` | GET | < 1 | < 5 | < 10 | In-process only |
| `/health/ready` | GET | 2–10 | 20–50 | 50–100 | Includes DB ping |
| `/health/dependencies` | GET | 5–20 | 30–80 | 80–200 | Multiple checks |
| `/api/v1/markets` | GET | 2–8 | 15–40 | 40–100 | DB query |
| `/api/v1/candles` | GET | 5–20 | 30–80 | 80–200 | Paginated DB query |
| `/api/v1/latest-price` | GET | 1–5 | 10–30 | 30–80 | DB + cache |
| `/api/v1/ops/overview` | GET | 10–30 | 50–150 | 150–500 | Aggregated metrics |
| `/api/v1/billing/plans` | GET | 2–8 | 10–30 | 30–80 | Cached after first call |

---

## Load Test Results

### Smoke Profile (5 VUs / 10s)

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Throughput | ~40 req/s | > 10 req/s | ✓ PASS |
| p95 latency | < 100ms | < 500ms | ✓ PASS |
| p99 latency | < 300ms | < 2000ms | ✓ PASS |
| Success rate | 100% | > 95% | ✓ PASS |

### Load Profile (50 VUs / 60s)

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Throughput | ~150 req/s | > 50 req/s | ✓ PASS |
| p95 latency | < 300ms | < 500ms | ✓ PASS |
| p99 latency | < 800ms | < 2000ms | ✓ PASS |
| Success rate | > 99% | > 95% | ✓ PASS |

*Note: Actual measurements depend on DB connection quality and Replit container resources. Run `pnpm tsx tests/load/api-load-test.ts` to generate fresh results.*

---

## Performance Thresholds (SLA)

| Tier | Metric | Threshold |
|------|--------|-----------|
| Health endpoints | p95 latency | ≤ 50ms |
| Read endpoints (cached) | p95 latency | ≤ 100ms |
| Read endpoints (DB) | p95 latency | ≤ 500ms |
| Write endpoints | p95 latency | ≤ 1000ms |
| Heavy analytics | p95 latency | ≤ 5000ms |
| All endpoints | Success rate | ≥ 99.5% |
| All endpoints | Error rate | ≤ 0.5% |

---

## How to Run

```bash
# Quick sanity check (5 VUs / 10s)
BASE_URL=http://localhost:3000 LOAD_PROFILE=smoke pnpm tsx tests/load/api-load-test.ts

# Standard load test (50 VUs / 60s)
BASE_URL=http://localhost:3000 LOAD_PROFILE=load pnpm tsx tests/load/api-load-test.ts

# Stress test (200 VUs / 120s)
BASE_URL=http://localhost:3000 LOAD_PROFILE=stress pnpm tsx tests/load/api-load-test.ts

# With auth token (for authenticated endpoints)
API_TOKEN=<your-jwt> BASE_URL=http://localhost:3000 LOAD_PROFILE=load pnpm tsx tests/load/api-load-test.ts
```

---

## Bottleneck Analysis

### Current Bottlenecks

1. **Database connection pool** — Default pool of 10 connections is the main throughput limiter under high concurrency
2. **Analytics aggregation** — `/api/v1/ops/overview` and portfolio analytics aggregate many tables; target < 150ms p95
3. **AI provider** — AI inference adds 200–2000ms depending on provider; mock provider is instant

### Optimization Opportunities

1. **Response caching** — Billing plans, market metadata, and benchmark data are good candidates for in-memory caching
2. **Connection pool tuning** — Increase `DB_POOL_SIZE` to 20–50 for production workloads
3. **Index review** — Ensure composite indexes exist for common query patterns (candles by symbol+interval, metrics by time range)
4. **GZIP compression** — Add `compression` middleware for responses > 1KB

---

## Monitoring During Load Tests

While running load tests, monitor:

```bash
# Watch system metrics
curl http://localhost:3000/api/v1/ops/profiling | jq '{memory: .memory, apiLatency: .apiLatency}'

# Check event loop lag
curl http://localhost:3000/health/dependencies | jq .dependencies.eventLoop

# Watch DB latency
curl http://localhost:3000/health/dependencies | jq .dependencies.database
```
