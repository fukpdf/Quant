# RUNBOOK.md — QuantForge Operations Runbook

> Operational procedures for common scenarios. Read in conjunction with DEPLOYMENT.md.

---

## Table of Contents

1. [Server Won't Start](#1-server-wont-start)
2. [Database Outage](#2-database-outage)
3. [API Outage / High Error Rate](#3-api-outage--high-error-rate)
4. [Streaming Failure](#4-streaming-failure)
5. [Scheduler Failure](#5-scheduler-failure)
6. [High Memory / CPU](#6-high-memory--cpu)
7. [Security Event Response](#7-security-event-response)
8. [Database Backup & Restore](#8-database-backup--restore)
9. [Disaster Recovery](#9-disaster-recovery)
10. [Alert Response Matrix](#10-alert-response-matrix)

---

## 1. Server Won't Start

**Symptoms**: Process exits immediately; `/health/live` unreachable.

**Diagnosis steps**:
```bash
# Check for environment variable issues
node -e "require('./dist/index.mjs')" 2>&1 | head -20

# Verify required env vars are set
echo "DATABASE_URL: ${DATABASE_URL:0:20}..."
echo "JWT_SECRET: ${JWT_SECRET:+set}"
echo "ENCRYPTION_KEY: ${ENCRYPTION_KEY:+set}"
echo "PORT: $PORT"
```

**Common causes and fixes**:

| Cause | Fix |
|-------|-----|
| `PORT` not set | Set `PORT=3000` in environment |
| `DATABASE_URL` not set | Provision database or set connection string |
| `JWT_SECRET` not set | Generate and set 32+ char random secret |
| `ENCRYPTION_KEY` not set | Generate and set 32+ char random key |
| Database tables missing | Run `pnpm --filter @workspace/db run push` |
| Build not run | Run `pnpm --filter @workspace/api-server run build` |
| esbuild version mismatch | `pnpm install --frozen-lockfile` |

---

## 2. Database Outage

**Symptoms**: `/health/ready` returns `status: "degraded"` or `"unavailable"`; DB-dependent endpoints return 503.

**Immediate response**:
1. Verify database connectivity: `psql "$DATABASE_URL" -c "SELECT 1"`
2. Check connection pool: look for `"Client checkout timed out"` in logs
3. If DB is down, the API server continues running but all DB operations fail gracefully

**Recovery steps**:
1. Restore database from latest backup (see Section 8)
2. Verify recovery: `psql "$DATABASE_URL" -c "SELECT count(*) FROM markets"`
3. Restart API server to re-initialize connection pool: restart the workflow
4. Confirm `/health/ready` returns `status: "ready"`

**Mitigation**: 
- Connection pool size is 10 by default (configurable via `DB_POOL_SIZE`)
- All DB errors are logged with full context via pino
- Schedulers are non-fatal — they log errors and retry next interval

---

## 3. API Outage / High Error Rate

**Symptoms**: `/health/live` returns 200 but requests fail; high 5xx rate in logs.

**Diagnosis**:
```bash
# Check recent error logs
grep '"statusCode":5' logs/api.log | tail -20

# Check ops overview for error rates
curl /api/v1/ops/overview | jq .platformScore

# Check system metrics
curl /api/v1/ops/system-metrics/live | jq .
```

**Common causes**:

| Cause | Diagnosis | Fix |
|-------|-----------|-----|
| Memory pressure | `heapUsedMb > 400` in metrics | Restart server; investigate memory leak |
| DB pool exhaustion | Pool timeout errors in logs | Check for long-running queries; reduce `DB_POOL_SIZE` |
| Rate limit flood | 429s in logs | Review and adjust rate limit settings |
| Unhandled promise rejection | `UnhandledPromiseRejection` in logs | Fix the route handler; report as bug |

**Response**:
1. If memory > 80% heap: restart the process
2. If DB pool exhausted: reduce pool size or scale DB
3. If route is failing: disable the route or roll back the deploy

---

## 4. Streaming Failure

**Symptoms**: `/api/v1/streams/health` shows health score < 50; ticks stop flowing.

**This is non-fatal** — the API server continues running without streaming. All non-streaming endpoints remain functional.

**Diagnosis**:
```bash
curl /api/v1/streams/status | jq .connected
curl /api/v1/streams/failures | jq .[0:3]
```

**Recovery**:
1. Check `STREAM_PROVIDER` env var (`mock` = always works; `binance` requires connectivity)
2. For Binance: verify network connectivity and API key validity
3. Restart the streaming scheduler: the server will auto-reconnect with exponential backoff
4. If mock provider fails: restart the API server process

**Gap recovery**: The `StreamRecoveryService` automatically backfills gaps via OHLCV REST API. No manual intervention needed for short outages (< 1 hour).

---

## 5. Scheduler Failure

**Symptoms**: Ops dashboard shows scheduler health warning; ingestion/paper/risk loops missed.

**Diagnosis**:
```bash
curl /api/v1/ops/schedulers/live | jq .
curl /api/v1/ops/schedulers | jq '[.[] | select(.consecutiveFails > 0)]'
```

**All schedulers are non-fatal** — individual loop failures are logged and retried on the next interval. A failed scheduler loop does NOT crash the server.

**Recovery**:
1. If a scheduler loop consistently fails (> 5 consecutive fails), check the underlying service
2. For ingestion failures: verify Binance connectivity or switch to mock provider
3. For risk scheduler failures: check DB connectivity and risk table health
4. Restart the server to reset all scheduler state if loops are stuck

**Scheduler intervals** (for context):
- Ingestion: every 5 minutes
- Paper trading signals: every 5 minutes  
- Risk snapshots: every 10 minutes
- Analytics: every 15 minutes–daily
- Ops metrics: every 30 seconds
- Intelligence: every 30 minutes–12 hours

---

## 6. High Memory / CPU

**Symptoms**: System metrics show `heapUsedMb > 600` or `cpuPercent > 80` sustained.

**Diagnosis**:
```bash
curl /api/v1/ops/system-metrics/live | jq '{heap: .heapUsedMb, cpu: .cpuPercent, eventLoop: .eventLoopLagMs}'
```

**Memory causes**:
- Large backtest results cached in memory: purge old backtest data from DB
- Streaming tick buffer growing: reduce `TICK_BATCH_SIZE` (default: 20)
- Memory leak in scheduler: restart server and monitor

**CPU causes**:
- Genetic algorithm / Monte Carlo running: these are CPU-intensive; expected
- High API request rate: check rate limiting; scale horizontally if needed
- Event loop lag > 100ms: look for synchronous blocking operations in route handlers

**Response**:
1. Memory > 800MB: restart server immediately (likely memory leak)
2. CPU > 90% sustained: check for runaway scheduler loop; restart if needed
3. Event loop lag > 500ms: all requests will be slow; restart to clear

---

## 7. Security Event Response

**Symptoms**: `GET /api/v1/security/events` shows suspicious activity; alert engine fires security alerts.

**Incident types**:

| Event | Severity | Response |
|-------|----------|----------|
| Multiple failed logins from same IP | Warning | Monitor; block IP if sustained |
| JWT with invalid signature | Critical | Rotate `JWT_SECRET`; invalidate all sessions |
| SQL injection attempt | Critical | Review WAF/rate-limit settings; log IP |
| Unauthorized admin access attempt | Critical | Review RBAC assignments; check user list |
| Encryption key exposure | Emergency | Rotate `ENCRYPTION_KEY`; re-encrypt all sensitive columns |

**JWT rotation procedure**:
1. Set new `JWT_SECRET` in environment
2. Restart server (all existing tokens are immediately invalidated)
3. Users must re-authenticate (expected disruption: 0–1 hour)
4. Monitor `security_events` table for continued suspicious activity

**Session invalidation**:
```bash
# Invalidate all active sessions (forces re-login for all users)
psql "$DATABASE_URL" -c "UPDATE sessions SET is_active = false WHERE is_active = true"
```

---

## 8. Database Backup & Restore

### Triggering a Manual Backup

```bash
# Via API (requires ops or admin permission)
curl -X POST /api/v1/ops/backups/{job_id}/run \
  -H "Authorization: Bearer $TOKEN"
```

### Backup Verification

All backups are automatically validated by checksum. Full restore tests run periodically.

```bash
# Check backup status
curl /api/v1/ops/backups | jq '[.[] | {status, sizeBytes, validatedAt}]'

# View restore test results
curl /api/v1/ops/recovery | jq '[.[] | {status, passed, durationMs}]'
```

### Manual Restore Procedure

In a Replit environment, database restore is performed through the Replit database tools.

For a PostgreSQL backup restore:
```bash
# 1. Stop the application server to prevent writes during restore
# 2. Restore from backup
pg_restore --clean --no-acl --no-owner \
  -d "$DATABASE_URL" \
  backup_<timestamp>.dump

# 3. Verify row counts match expected
psql "$DATABASE_URL" -c "\dt+" | head -20

# 4. Restart the application server
# 5. Verify health endpoints
curl /health/ready
```

### Retention Policy

Default backup retention: **7 most recent runs per job**.
Backup jobs are configured via `POST /api/v1/ops/backups` (job configuration).
Expired backups are marked `status = expired` but not deleted from the audit log.

---

## 9. Disaster Recovery

### Scenario: Full Server Loss

1. **Provision new environment** with all required env vars (see DEPLOYMENT.md)
2. **Restore database** from latest backup (Section 8)
3. **Install and build**: `pnpm install --frozen-lockfile && pnpm run build`
4. **Apply schema**: `pnpm --filter @workspace/db run push`
5. **Start application**: workflow or `node dist/index.mjs`
6. **Verify**: `/health/ready` returns `ready`
7. **Recovery time target**: < 30 minutes

### Scenario: Corrupt Database

1. **Stop all writes**: activate kill switch via API or stop server
2. **Identify corruption scope**: check error logs for affected tables
3. **Restore from backup**: use most recent clean backup
4. **Replay missed transactions**: if audit log is intact, replay events
5. **Resume operations**: restart server and deactivate kill switch

### Scenario: Compromised Credentials

1. **Immediately rotate** all secrets: `JWT_SECRET`, `ENCRYPTION_KEY`, `SESSION_SECRET`
2. **Invalidate all sessions** (see Section 7)
3. **Revoke all API keys**: `DELETE /api/v1/api-keys/<id>` for all keys
4. **Rotate exchange API keys** in Binance/provider dashboards
5. **Audit security events**: `GET /api/v1/security/events` for scope of exposure
6. **Change database password** and update `DATABASE_URL`
7. **Notify affected users** if any user data was potentially exposed

### RPO / RTO Targets

| Metric | Target |
|--------|--------|
| Recovery Point Objective (RPO) | < 6 hours (backup interval) |
| Recovery Time Objective (RTO) | < 30 minutes |
| Backup verification frequency | Every backup run |
| Restore test frequency | Weekly |

---

## 10. Alert Response Matrix

| Alert Rule | Severity | First Response | Escalation |
|------------|----------|----------------|------------|
| No ingestion in 30m | Warning | Check ingestion scheduler | Restart ingestion loop |
| High ingestion failure rate | Critical | Check Binance connectivity | Switch to mock provider |
| Scheduler missed > 3 | Warning | Check logs | Restart affected scheduler |
| Service degraded | Warning | Check service health | Investigate and restart |
| Memory > 80% | Critical | Monitor | Restart server |
| AI errors > 20% | Warning | Check AI provider | Switch to mock provider |
| Execution rejections > 30% | Critical | Check risk engine | Review risk profiles |
| Drawdown breach | Critical | Review positions | Activate kill switch if needed |
| Emergency alert | Emergency | Immediate investigation | Activate kill switch |
