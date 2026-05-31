# QuantForge — Personal Quantitative Trading Platform

> A professional-grade research, backtesting, paper trading, risk management, analytics, and execution platform for multiple asset classes.

---

## Vision

QuantForge is a personal quantitative trading platform designed to support the full research-to-execution lifecycle. It provides rigorous, data-driven tools for developing, testing, and running systematic trading strategies across crypto, forex, stocks, indices, and commodities — with institutional-grade discipline applied to personal-scale trading.

---

## Objectives

- Aggregate and store high-quality market data across multiple asset classes
- Enable rigorous quantitative research and strategy development
- Provide realistic backtesting with transaction cost modeling
- Support paper trading with production-equivalent order simulation
- Enforce position sizing, drawdown limits, and exposure rules via a risk engine
- Deliver portfolio analytics and performance attribution
- (Future) Connect to live execution endpoints with full audit trails
- (Future) Integrate an AI research assistant for hypothesis generation

---

## Repository Structure

```
quantforge/
├── README.md                   # This file
├── PROJECT_MASTER.md           # Project brain — vision, architecture, phases
├── AGENTS.md                   # AI agent operating instructions
├── RULES.md                    # Development rules and standards
├── TODO.md                     # Phased roadmap and task checklists
├── CHANGELOG.md                # Change history
├── DECISIONS.md                # Architecture decision records
├── SECURITY.md                 # Security policy and secret management
├── CONTRIBUTING.md             # Contribution guidelines
├── .env.example                # Environment variable template (no real values)
├── .gitignore                  # Git ignore rules
│
├── docs/                       # Deep documentation
│   ├── 01-VISION.md
│   ├── 02-PRODUCT_REQUIREMENTS.md
│   ├── 03-TECHNICAL_REQUIREMENTS.md
│   ├── 04-SYSTEM_ARCHITECTURE.md
│   ├── 05-DATABASE_ARCHITECTURE.md
│   ├── 06-SECURITY_ARCHITECTURE.md
│   ├── 07-RISK_MANAGEMENT.md
│   ├── 08-TRADING_RESEARCH.md
│   ├── 09-API_STRATEGY.md
│   └── 10-IMPLEMENTATION_PLAN.md
│
├── frontend/                   # Web UI (React + Vite)
├── backend/                    # API server (Express + TypeScript)
├── database/                   # Schema, migrations, seeds
├── strategies/                 # Strategy definitions and configurations
├── tests/                      # Test suites
├── scripts/                    # Utility and operational scripts
├── infrastructure/             # Deployment and infrastructure config
│
└── .github/                    # GitHub templates
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

---

## Current Phase

**Phase 0 — Repository Foundation**

Establishing the project operating system: documentation structure, development workflow, security framework, and AI-agent operating environment.

See [TODO.md](./TODO.md) for the full roadmap.

---

## Roadmap Summary

| Phase | Name | Status |
|-------|------|--------|
| 0 | Repository Foundation | 🟡 In Progress |
| 1 | Market Data Platform | ⬜ Planned |
| 2 | Historical Data Storage | ⬜ Planned |
| 3 | Research Laboratory | ⬜ Planned |
| 4 | Backtesting Engine | ⬜ Planned |
| 5 | Paper Trading | ⬜ Planned |
| 6 | Risk Engine | ⬜ Planned |
| 7 | Portfolio Analytics | ⬜ Planned |
| 8 | Execution Engine | ⬜ Planned |
| 9 | AI Research Assistant | ⬜ Planned |
| 10 | Production Readiness | ⬜ Planned |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 24, TypeScript 5.9 |
| API Server | Express 5 |
| Frontend | React 19 + Vite |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4 |
| Package Manager | pnpm (workspaces) |
| API Contract | OpenAPI 3.1 + Orval codegen |
| Environment | Replit (dev), GitHub (source control) |

---

## Quick Start

> Application code does not exist yet. This is Phase 0 — foundation only.

Once Phase 1 is complete:

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Fill in required values

# Start development
pnpm run dev
```

---

## For AI Agents

**Read [AGENTS.md](./AGENTS.md) before writing any code.**

It contains mandatory pre-coding and post-coding protocols that all agents must follow.
