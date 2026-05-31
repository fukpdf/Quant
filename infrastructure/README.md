# /infrastructure — Infrastructure Configuration

> Status: Minimal placeholder. Infrastructure configuration grows with each phase.

---

## Purpose

This directory contains all infrastructure-as-code, deployment configuration, and operational tooling for the QuantForge platform.

---

## Current State (Phase 0)

The platform currently runs entirely on Replit. No additional infrastructure configuration is required until Phase 10 (Production Readiness).

Primary infrastructure:
- **Compute**: Replit (Node.js 24 runtime)
- **Database**: Replit PostgreSQL
- **Secrets**: Replit Secrets panel
- **Deployment**: Replit Deployments (`.replit-artifact/`)

---

## Planned Structure

```
infrastructure/
├── README.md                          # This file
│
├── replit/                            # Replit-specific configuration
│   └── (artifact.toml files managed by Replit tooling)
│
├── github-actions/                    # CI/CD workflows (Phase 10)
│   ├── ci.yml                         # Continuous integration
│   ├── deploy-staging.yml             # Staging deployment
│   └── deploy-production.yml          # Production deployment
│
├── monitoring/                        # Monitoring configuration (Phase 10)
│   ├── alerts.yml                     # Alert rules
│   └── dashboards/                    # Monitoring dashboards
│
└── scripts/                           # Infrastructure scripts
    ├── provision-db.sh                # Database provisioning
    └── rotate-secrets.sh              # Secret rotation guide
```

---

## Deployment Architecture

See [docs/04-SYSTEM_ARCHITECTURE.md](../docs/04-SYSTEM_ARCHITECTURE.md) for the current deployment architecture diagram.

---

## Environment Summary

| Environment | Platform | Database | Secrets |
|-------------|----------|----------|---------|
| Development | Replit | Replit PostgreSQL | Replit Secrets |
| Staging | Replit (Phase 10) | Replit PostgreSQL | Replit Secrets |
| Production | Replit Deployments | Replit PostgreSQL | Replit Secrets |

---

## CI/CD (Phase 10)

GitHub Actions will be configured in Phase 10 with the following pipeline:

```
Push to feature branch
  └── CI: typecheck + lint + tests

Pull Request to main
  └── CI: full test suite + security scan

Merge to main
  └── Deploy to staging
  └── Smoke tests
  └── Manual approval gate
  └── Deploy to production
```

---

## Secrets in CI/CD (Phase 10)

GitHub Actions Secrets required:
- `DATABASE_URL` — staging database connection string
- `DATABASE_URL_PROD` — production database connection string
- Any exchange or data provider API keys needed for integration tests

---

## For AI Agents

Before modifying infrastructure configuration:
1. Read [AGENTS.md](../AGENTS.md)
2. Infrastructure changes are primarily in Phase 10 scope
3. Replit artifact configuration is managed by Replit tooling — do not edit `artifact.toml` directly
4. Any infrastructure decision must be documented in DECISIONS.md
5. Never store real credentials in infrastructure files — use secret references only
