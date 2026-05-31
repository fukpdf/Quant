# SECURITY.md — Security Policy

> Security is non-negotiable. When security conflicts with convenience, security wins.

---

## Scope

This document covers the security policy for the QuantForge personal quantitative trading platform. It applies to all code, configuration, scripts, documentation, and infrastructure in this repository.

---

## Secret Management Strategy

### Principle: Zero Secrets in Code

No secret, credential, API key, password, token, or sensitive configuration value is ever committed to this repository. This includes:

- API keys (exchange APIs, data providers, LLM providers)
- Database connection strings with passwords
- JWT secrets and encryption keys
- Webhook secrets
- OAuth client secrets
- Any value that, if exposed, would grant access to a system or incur financial liability

### Where Secrets Live

| Environment | Secret Storage |
|-------------|---------------|
| Development (Replit) | Replit Secrets panel (never in `.env` file) |
| CI/CD (GitHub Actions) | GitHub Actions Secrets |
| Production | Environment variables injected at runtime (never baked into build artifacts) |

### .env Files

- `.env` is **gitignored** — it must never appear in git history
- `.env.local` is **gitignored**
- `.env.example` contains only placeholder variable names and comments — **no real values ever**
- If a `.env` file is ever accidentally committed, immediately:
  1. Rotate every secret it contained
  2. Use `git filter-branch` or BFG Repo Cleaner to purge it from history
  3. Force-push and notify any collaborators

---

## Environment Variable Strategy

### Naming Conventions

| Category | Prefix | Example |
|----------|--------|---------|
| Database | `DATABASE_` | `DATABASE_URL` |
| External API | `<PROVIDER>_API_KEY` | `BINANCE_API_KEY` |
| Application | `APP_` | `APP_JWT_SECRET` |
| Infrastructure | `REDIS_`, `SUPABASE_` | `REDIS_URL` |
| Internal | `INTERNAL_` | `INTERNAL_ENCRYPTION_KEY` |

### Rules

1. Every environment variable must be documented in `.env.example` with a comment
2. Optional variables must be clearly marked as optional with their default value
3. Required variables must cause the application to fail fast on startup if missing
4. No environment variable is logged in plain text — mask sensitive values in logs

### Startup Validation

Application startup must validate all required environment variables before accepting traffic. Missing required variables → process exits with a descriptive error message.

---

## API Key Handling

### Exchange API Keys

- Use **read-only keys** wherever possible (market data, account monitoring)
- Use **write-capable keys** (order placement) only in Phase 8+, with minimum necessary permissions
- Store separately from read-only keys
- IP-whitelist exchange API keys where the provider supports it
- Set withdrawal permissions to **disabled** on all exchange API keys — QuantForge never moves funds off-exchange

### Data Provider Keys

- Treat data provider keys as read-only credentials
- Rotate quarterly or on any suspected exposure

### LLM Provider Keys

- LLM keys go via Replit AI Integrations (no user-managed key required)
- If direct API access is needed, treat like any other API key

---

## Replit Secrets Usage

In the Replit development environment, all secrets are managed via the Replit Secrets panel:

1. Never create a `.env` file in the Replit workspace
2. Set secrets via the Secrets panel UI or Replit API
3. Access secrets in code via `process.env.SECRET_NAME` — they are injected automatically
4. Secrets are not shared between Repls and are not visible in git

---

## GitHub Secrets Usage

For CI/CD workflows (configured in Phase 10):

1. Add secrets via **Settings → Secrets and variables → Actions**
2. Reference in workflows as `${{ secrets.SECRET_NAME }}`
3. GitHub automatically masks secret values in workflow logs
4. Use environment-scoped secrets for production deployments (require reviewer approval)

---

## Security Principles

### 1. Defense in Depth

Never rely on a single security control. Layer controls:
- Authentication at the API gateway
- Authorization at the service layer
- Input validation at every boundary
- Audit logging at the data layer

### 2. Principle of Least Privilege

Every service, user, and API key gets only the minimum permissions required:
- Database users have table-level permissions, not database-level
- Exchange API keys have endpoint-level permissions, not account-level
- Application service accounts have read-only access unless write is explicitly required

### 3. Input Sanitization

Never trust any input — API request bodies, query parameters, headers, file uploads, or database results passed between services. Validate with Zod schemas at every boundary.

### 4. Audit Everything Sensitive

The following operations must be logged with actor, timestamp, action, result, and relevant metadata:
- Authentication events (login, logout, token refresh, failure)
- API key usage
- Order submissions (paper and live)
- Risk limit overrides
- Configuration changes
- Any operation that modifies financial state

### 5. No Autonomous Financial Decisions

AI components may:
- Generate strategy hypotheses
- Analyze backtest results
- Flag anomalies

AI components may NOT:
- Submit orders without human review
- Override risk limits
- Modify strategy parameters in production

### 6. Encryption in Transit

- All HTTP traffic uses TLS in staging and production
- No plain HTTP endpoints in production
- Internal service-to-service communication uses TLS where network boundaries cross

### 7. Encryption at Rest

- Database credentials, API keys stored in the database are encrypted at the column level
- Backup files are encrypted before storage

---

## Vulnerability Disclosure

This is a personal project with no external users. If you discover a security vulnerability:

1. Do not open a public GitHub issue
2. Contact the project owner directly
3. Allow reasonable time for remediation before any disclosure

---

## Future Audit Requirements

The following security activities are planned for Phase 10 (Production Readiness):

- [ ] Dependency vulnerability audit (`pnpm audit`)
- [ ] Static analysis security testing (SAST)
- [ ] Secret scanning (GitHub's secret scanner or truffleHog)
- [ ] OWASP Top 10 checklist review
- [ ] Database permission audit
- [ ] API authentication and authorization review
- [ ] Logging and monitoring review for sensitive data leakage
- [ ] Third-party service access review
- [ ] API key rotation procedure test

---

## Incident Response

If a security incident is suspected:

1. **Contain** — Immediately revoke the suspected compromised credential
2. **Assess** — Determine what was accessed and for how long
3. **Rotate** — Replace all credentials that may have been exposed
4. **Document** — Record the incident in CHANGELOG.md under a security section
5. **Review** — Determine how the control failure occurred and add a preventive control
