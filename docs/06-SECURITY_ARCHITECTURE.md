# 06-SECURITY_ARCHITECTURE.md — Security Architecture

> Status: Phase 0 outline — implementation details populated as each phase begins.

---

## Threat Model

### Assets to Protect

| Asset | Value | Threat |
|-------|-------|--------|
| Exchange API keys | High — grants trading access | Theft, exfiltration, unauthorized use |
| Database credentials | High — grants data access | Theft, unauthorized access |
| Historical market data | Medium — time investment to collect | Corruption, loss |
| Strategy configurations | Medium — competitive value | Unauthorized access, modification |
| Trade records and P&L | Medium — financial privacy | Unauthorized disclosure |
| JWt secrets | Medium — enables session forgery | Theft, use to impersonate |
| Encryption keys | High — decrypts sensitive DB columns | Theft |

### Threat Actors

| Actor | Motivation | Capability |
|-------|-----------|------------|
| Automated scanners | Credential harvesting | Low — opportunistic |
| Supply chain attacks | Code injection via dependencies | Medium |
| Insider (self) | Accidental exposure | Medium — most likely risk |
| API abuse | Rate limit exploitation, data scraping | Low |

### Primary Risk Vectors

1. **Secret exposure via git** — most likely risk for a personal project; mitigated by gitignore and pre-commit checks
2. **Compromised dependency** — mitigated by `pnpm audit` and pinned versions
3. **Leaked API key via logs** — mitigated by log sanitization rules
4. **Unauthorized API access** — mitigated by authentication (Phase 8) and rate limiting (Phase 10)

---

## Security Controls by Layer

### Application Layer

| Control | Description | Phase |
|---------|-------------|-------|
| Input validation | All inputs validated with Zod schemas | Phase 1 |
| Error handling | Errors do not leak stack traces or internal details to clients | Phase 1 |
| Dependency audit | `pnpm audit` run before each phase release | All |
| Secret scanning | No hardcoded secrets in code | All |
| Request logging | All requests logged with sanitized headers | Phase 1 |

### API Layer (Phase 8+)

| Control | Description |
|---------|-------------|
| JWT authentication | All endpoints except `/healthz` require valid JWT |
| JWT expiry | Tokens expire after 24 hours |
| Rate limiting | Per-IP and per-endpoint rate limits |
| CORS policy | Explicit allowlist of origins; no wildcards in production |
| HTTPS only | No plain HTTP in staging or production |
| HSTS | HTTP Strict Transport Security header on all responses |

### Database Layer

| Control | Description | Phase |
|---------|-------------|-------|
| Parameterized queries | Drizzle ORM exclusively; no string interpolation in SQL | All |
| Least privilege | DB user has table-level permissions, not database-level | Phase 2 |
| Column encryption | Sensitive columns (API keys if stored) encrypted at rest | Phase 5 |
| Connection pooling | Maximum connections limited; no unlimited pool | Phase 2 |
| SSL connection | Database connections use SSL in production | Phase 2 |

### Infrastructure Layer (Phase 10)

| Control | Description |
|---------|-------------|
| TLS everywhere | All network traffic encrypted |
| Secrets rotation | Quarterly rotation of all long-lived credentials |
| Backup encryption | All backups encrypted before storage |
| Access logging | All infrastructure access logged |
| Dependency vulnerability scanning | Automated CVE scanning |

---

## Authentication Architecture (Phase 8)

### Session Flow

```
Client
  │
  │ POST /api/v1/auth/login (credentials)
  ▼
API Gateway
  │
  │ Validate credentials
  │ Generate JWT (signed with JWT_SECRET)
  │ Set HttpOnly cookie with JWT
  ▼
Client (subsequent requests)
  │
  │ GET /api/v1/... (with JWT cookie)
  ▼
API Gateway
  │
  │ Verify JWT signature
  │ Check token expiry
  │ Extract claims
  ▼
Route Handler
```

### JWT Structure

```json
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": "user-id",
    "iat": 1700000000,
    "exp": 1700086400,
    "jti": "unique-token-id"
  }
}
```

### Token Storage

- JWTs stored in HttpOnly, Secure, SameSite=Strict cookies
- Not stored in localStorage (XSS vulnerability)
- Token refresh handled via `/api/v1/auth/refresh` endpoint

---

## Secret Management

### Secret Classification

| Class | Examples | Storage |
|-------|---------|---------|
| Critical | Exchange API keys, JWT secret, encryption key | Replit Secrets (dev), Runtime env (prod) |
| High | Database URL, OAuth secrets | Replit Secrets (dev), Runtime env (prod) |
| Medium | Data provider API keys | Replit Secrets (dev), Runtime env (prod) |
| Low | Log level, feature flags | `.env.example` template, runtime env |

### Secret Rotation Schedule

| Secret | Rotation Frequency | Trigger for Immediate Rotation |
|--------|-------------------|-------------------------------|
| Exchange API keys | Quarterly | Suspected exposure, provider breach |
| JWT secret | Quarterly | Suspected exposure (invalidates all sessions) |
| Encryption key | Annually (with re-encryption) | Suspected exposure |
| Database password | Quarterly | Suspected exposure |
| Data provider keys | Quarterly | Suspected exposure |

---

## Audit Logging

### Events That Must Be Logged

All audit log entries include: `event_type`, `actor`, `timestamp`, `resource_type`, `resource_id`, `before_state`, `after_state`, `metadata`.

| Event | Minimum Log Level |
|-------|------------------|
| Strategy created / modified / deleted | INFO |
| Risk limit changed | WARN |
| Risk limit breached | WARN |
| Paper order submitted | INFO |
| Paper order rejected by risk engine | WARN |
| Live order submitted (Phase 8) | INFO |
| Live order rejected | WARN |
| Kill switch activated (Phase 8) | ERROR |
| API key used (exchange) | INFO |
| Authentication failure | WARN |
| Authentication success (Phase 8) | INFO |
| Database backup completed | INFO |
| Database backup failed | ERROR |

### What Must NOT Be Logged

- Passwords (even hashed)
- API keys (even partial — use `<redacted>`)
- JWT tokens
- Database credentials
- Any value from the `ENCRYPTION_KEY` or `JWT_SECRET` env variables
- Full request bodies if they contain credential fields

---

## Dependency Security

### Approved Dependency Policy

1. All dependencies must have > 100k weekly npm downloads OR be officially maintained by a major organization
2. Dependencies with known high/critical CVEs are not used (enforced by `pnpm audit`)
3. Major version upgrades documented in DECISIONS.md
4. `pnpm audit` run before each phase release; output reviewed and all critical/high CVEs addressed

### Supply Chain Protection

- `pnpm-lock.yaml` committed to git (prevents dependency tampering)
- `pnpm install --frozen-lockfile` in CI/CD (ensures exact version match)
- No `preinstall`/`postinstall` scripts from third-party packages without review

---

## Security Checklist (Per Phase)

Before each phase is considered complete:

- [ ] `pnpm audit` run; all HIGH and CRITICAL issues addressed
- [ ] No secrets found by `grep` scan across all committed files
- [ ] All new API endpoints have input validation with Zod schemas
- [ ] All new API endpoints log appropriately (no secret leakage in logs)
- [ ] All new database operations use Drizzle (no raw SQL string interpolation)
- [ ] All new environment variables documented in `.env.example`
- [ ] CHANGELOG.md updated with security-relevant changes
