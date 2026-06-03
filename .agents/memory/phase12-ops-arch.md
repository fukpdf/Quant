---
name: Phase 12 ops architecture
description: Key design rules and gotchas for the Phase 12 observability/monitoring layer — safety boundary, scheduler pattern, DB access, incident rules.
---

**READ-ONLY safety boundary (ADR-038)**
Phase 12 services only read from Phase 1–11 tables. They never write to trading tables or call any execution path. A malfunctioning monitoring loop must not affect capital.

**ops-db.ts is the sole DB access point**
Route files and services must never import Phase 12 tables directly. All reads/writes go through `ops-db.ts`.

**10 independent non-fatal scheduler loops (ADR-039)**
`ops-scheduler.ts` runs: system-metrics (30s), service-health (2m), alert-eval (60s), scheduler-snapshot (60s), stream-snapshot (2m), strategy-health (5m), AI-health (15m), execution-health (15m), incident-scan (5m), performance-snapshot (15m). Every loop is try/catch — exceptions are logged, never propagated.

**Incident auto-creation = emergency severity only (ADR-040)**
`warning` and `critical` alerts create alert events but NOT incidents. Only `emergency` alerts auto-open incidents. Operators can manually link any alert to an incident via the timeline API.

**12 built-in alert rules seeded on startup**
`alert-engine.ts` upserts `DEFAULT_ALERT_RULES` on every server start. To add a new rule, add it to that array — no migration needed.

**Live vs DB endpoints**
- `GET /api/v1/ops/system-metrics/live` — in-memory from `MetricsCollector`, no DB round-trip
- `GET /api/v1/ops/schedulers/live` — in-memory from `SchedulerMonitor`, no DB round-trip
- All other ops endpoints read from DB

**Column correctness (learned from Phase 12 fixes)**
- `aiUsageMetricsTable.totalTokens` (not `tokensUsed`)
- `aiUsageMetricsTable.status` (not `errorMessage`)
- `executionLatencyTable.latencyMs` with `stage='end_to_end'` filter (not `totalLatencyMs`)
