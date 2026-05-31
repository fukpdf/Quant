# 04-SYSTEM_ARCHITECTURE.md — System Architecture

> Status: Phase 0 outline — architecture diagrams and service details populated as each phase begins.

---

## Architecture Philosophy

1. **API-first**: All services communicate via versioned OpenAPI contracts. No shared memory, no direct DB access across service boundaries.
2. **Event-driven core**: Market data, signals, orders, and fills flow through a structured event bus. Services react to events, they do not poll.
3. **Separation of concerns**: Data ingestion, research, risk, and execution are fully decoupled. Each can be replaced without touching others.
4. **Immutable audit log**: Nothing is ever deleted from the audit trail. The event log is append-only.
5. **Simplicity first**: No distributed system complexity until it is clearly required. Start with a well-structured monolith; extract services when bottlenecks are proven.

---

## High-Level Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
│                    Dashboard, Research UI                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                    API Gateway (Express 5)                        │
│                 OpenAPI 3.1 / Zod Validation                     │
│                  Authentication / Rate Limiting                  │
└──────┬──────────────┬──────────────┬──────────────┬─────────────┘
       │              │              │              │
       ▼              ▼              ▼              ▼
  Market Data     Research        Risk          Execution
   Service         Engine         Engine         Engine
  (Phase 1)      (Phase 3)      (Phase 6)      (Phase 8)
       │              │              │              │
       └──────────────┴──────────────┴──────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    PostgreSQL      │
                    │  Primary Database  │
                    │  (All Phases)      │
                    └───────────────────┘
```

---

## Service Boundaries

### API Gateway (Phase 0 skeleton, Phase 1+)
- **Responsibility**: Single entry point for all client requests
- **Technology**: Express 5 + TypeScript
- **Port**: Assigned by Replit proxy (served at `/api` path)
- **Responsibilities**:
  - Request routing to internal modules
  - Authentication (Phase 8)
  - Input validation via generated Zod schemas
  - Request/response logging
  - Rate limiting (Phase 10)
  - Health check endpoint

### Market Data Service (Phase 1)
- **Responsibility**: Ingest, normalize, and distribute market data
- **Inputs**: Exchange WebSocket feeds, REST APIs from data providers
- **Outputs**: Normalized OHLCV events written to database; real-time events published to in-process event bus
- **Key concerns**: Connection resilience, data normalization, quality validation

### Research Engine (Phase 3)
- **Responsibility**: Indicator calculation, strategy definition, research API
- **Inputs**: Historical data from database, indicator parameters
- **Outputs**: Computed indicator values, strategy signals
- **Key concerns**: Accuracy (match reference implementations), performance for large datasets

### Backtesting Engine (Phase 4)
- **Responsibility**: Simulate strategy execution against historical data
- **Inputs**: Strategy definition, historical data, simulation parameters
- **Outputs**: Trade records, performance metrics, equity curve
- **Key concerns**: No look-ahead bias, reproducibility, realistic cost modeling

### Paper Trading Engine (Phase 5)
- **Responsibility**: Simulate strategy execution against live market data
- **Inputs**: Strategy signals, live market data feed, paper account state
- **Outputs**: Simulated orders, fills, position updates, P&L
- **Key concerns**: Realistic fill simulation, state persistence, isolation from live trading

### Risk Engine (Phase 6)
- **Responsibility**: Pre-trade risk validation and post-trade exposure monitoring
- **Inputs**: Proposed orders, current positions, risk configuration
- **Outputs**: Approval or rejection (with reason), exposure reports
- **Key concerns**: No order bypasses risk checks; all rejections are logged

### Portfolio Analytics (Phase 7)
- **Responsibility**: Performance measurement, attribution, reporting
- **Inputs**: Trade history, market data, benchmark data
- **Outputs**: Performance metrics, attribution reports, trade journal exports
- **Key concerns**: Mathematical accuracy of TWR/MWR calculations

### Execution Engine (Phase 8)
- **Responsibility**: Route approved orders to live brokers
- **Inputs**: Risk-approved orders, broker credentials
- **Outputs**: Order confirmations, fill events, reconciliation reports
- **Key concerns**: Reliability, audit trail completeness, kill switch effectiveness

---

## Data Flow

### Market Data Ingestion Flow (Phase 1)

```
Exchange/Provider
      │
      │ WebSocket / REST
      ▼
Data Adapter (provider-specific)
      │
      │ Raw market event
      ▼
Normalization Layer
      │
      │ Unified OHLCV event
      ▼
Quality Validator
      │
      ├─── Pass ──→ Database Write + In-Process Event Bus
      │
      └─── Fail ──→ Quality Log + Alert
```

### Strategy Signal Flow (Phase 5+)

```
Market Data Event
      │
      ▼
Strategy Engine (computes indicators + signals)
      │
      ▼
Risk Engine (pre-trade validation)
      │
      ├─── Reject ──→ Rejection Log
      │
      └─── Approve ──→ Order Router
                              │
                              ├─── Paper ──→ Paper Trading Engine
                              │
                              └─── Live ──→ Execution Engine (Phase 8)
```

---

## Technology Stack Detail

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| HTTP Framework | Express 5 | API routing, middleware |
| Language | TypeScript 5.9 (strict) | Type safety |
| Validation | Zod v4 (generated) | Input/output validation |
| ORM | Drizzle | Type-safe database access |
| Logging | pino | Structured JSON logging |
| Build | esbuild | Fast TypeScript compilation |

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 19 | UI rendering |
| Build | Vite 6 | Dev server, bundling |
| API client | Orval-generated React Query hooks | Data fetching |
| Styling | Tailwind CSS + shadcn/ui | Component library |

### Data

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Primary DB | PostgreSQL 16+ | All application and market data |
| ORM | Drizzle ORM | Schema definition and queries |
| Schema validation | drizzle-zod | Zod schemas from Drizzle schema |
| Migrations | Drizzle Kit | Schema migrations |

---

## Deployment Architecture (Phase 10 Target)

```
                    ┌─────────────────────┐
                    │   Replit Deployment  │
                    │     (Production)     │
                    │                      │
                    │  ┌────────────────┐  │
                    │  │  Express API   │  │
                    │  │   (Node.js)    │  │
                    │  └───────┬────────┘  │
                    │          │           │
                    │  ┌───────▼────────┐  │
                    │  │  PostgreSQL    │  │
                    │  │  (Replit DB)   │  │
                    │  └────────────────┘  │
                    └─────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │   GitHub Actions   │
                    │   (CI/CD Phase 10) │
                    └───────────────────┘
```

---

## Monorepo Structure

```
quantforge/
├── artifacts/
│   ├── api-server/         # Express API server (@workspace/api-server)
│   └── frontend/           # React + Vite frontend (@workspace/frontend) [Phase 1]
│
├── lib/
│   ├── api-spec/           # OpenAPI spec + codegen config (@workspace/api-spec)
│   ├── api-client-react/   # Generated React Query hooks (@workspace/api-client-react)
│   ├── api-zod/            # Generated Zod schemas (@workspace/api-zod)
│   └── db/                 # Drizzle schema + database client (@workspace/db)
│
├── docs/                   # Documentation
├── strategies/             # Strategy definitions and configurations
├── scripts/                # Utility scripts (@workspace/scripts)
└── infrastructure/         # Deployment configuration
```

---

## Cross-Cutting Concerns

### Error Handling Strategy
- All async route handlers wrapped in a global error handler middleware
- Errors logged with full context (request ID, user, path, error, stack)
- Operational errors return appropriate HTTP status codes with structured error bodies
- Programming errors (bugs) are logged and cause a non-zero exit for restart
- 4xx errors: client's fault (validation, not found, unauthorized)
- 5xx errors: server's fault (internal errors, downstream failures)

### Request Tracing
- Every request gets a unique request ID (`X-Request-Id` header)
- Request ID propagated through all service calls
- Logs correlation via request ID allows tracing a request through all service layers

### Configuration Management
- All configuration via environment variables
- Required variables validated at startup
- Configuration is read once at startup and cached (not read per-request)
- No feature flags in early phases — configuration is explicit

### Versioning Strategy
- API versioned via URL prefix: `/api/v1/`
- Database schema versioned via Drizzle migrations
- Application versioned via `package.json` semver
- Phase transitions tagged as minor versions (`0.1.0`, `0.2.0`, etc.)
