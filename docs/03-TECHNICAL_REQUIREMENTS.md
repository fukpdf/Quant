# 03-TECHNICAL_REQUIREMENTS.md — Technical Requirements

> Status: Phase 0 outline — detailed requirements populated as each phase begins.

---

## Runtime & Language Requirements

| Requirement | Specification |
|-------------|--------------|
| Node.js version | 24 LTS or later |
| TypeScript version | 5.9 or later |
| Strict mode | Always enabled — no exceptions |
| Target | ES2022 / CommonJS for server, ESNext for frontend |
| Package manager | pnpm 9+ with workspaces |

---

## Performance Requirements

### API Server

| Metric | Requirement | Phase |
|--------|-------------|-------|
| Response time (p50) | < 100ms | Phase 1 |
| Response time (p95) | < 500ms | Phase 1 |
| Response time (p99) | < 1000ms | Phase 1 |
| Throughput | > 100 req/s (single instance) | Phase 2 |
| Backtest throughput | > 100,000 bars/second | Phase 4 |

### Data Ingestion

| Metric | Requirement | Phase |
|--------|-------------|-------|
| WebSocket reconnect time | < 5 seconds | Phase 1 |
| Data gap rate | < 0.1% of expected bars | Phase 1 |
| Normalization latency | < 10ms per bar | Phase 1 |
| Ingestion-to-storage latency | < 1 second | Phase 2 |

### Database

| Metric | Requirement | Phase |
|--------|-------------|-------|
| OHLCV query (1 year daily) | < 2 seconds | Phase 2 |
| OHLCV query (10 years daily) | < 10 seconds | Phase 2 |
| Write throughput | > 10,000 rows/second | Phase 2 |
| Backup completion | < 1 hour for full backup | Phase 2 |

---

## Scalability Requirements

- The system is designed for a single operator — no multi-user scalability required in Phases 0–9
- Data storage must handle at minimum: 10 years × 500 symbols × 1440 minute-bars = ~2.6 billion rows
- PostgreSQL table partitioning strategy must support this volume with query performance requirements met
- Backtest engine must handle strategy universes of up to 100 symbols simultaneously

---

## Reliability Requirements

| Requirement | Target | Phase |
|-------------|--------|-------|
| API uptime | > 99.5% | Phase 5 |
| Data feed uptime | > 99.5% per feed | Phase 1 |
| Zero data loss (historical) | 100% | Phase 2 |
| Backup recovery tested | Quarterly | Phase 2 |
| Backtest reproducibility | 100% (same inputs → same outputs) | Phase 4 |

---

## Observability Requirements

### Logging
- All server-side code uses structured JSON logging (never `console.log`)
- Log levels: debug, info, warn, error
- Request logs include: method, path, status, duration, request ID
- Error logs include: error message, stack trace, request context
- All financial operations (orders, fills, risk events) logged at INFO level minimum

### Health Checks
- Every service exposes `GET /api/healthz` returning `{ status: "ok", version, uptime }`
- Health checks return within 500ms
- Health checks verify database connectivity

### Metrics (Phase 10)
- Request count and latency per endpoint
- Error rate per endpoint
- Data feed lag (seconds since last bar received)
- Position count and exposure levels
- Drawdown from high water mark

---

## Security Technical Requirements

### Authentication (Phase 8+)
- JWT-based session tokens
- Token expiry: 24 hours for standard sessions
- Token refresh without re-authentication within expiry window
- All API endpoints require authentication except `/healthz`

### Input Validation
- Every API request body validated with generated Zod schemas
- Query parameters validated with explicit Zod schemas
- File uploads: type verification, size limits, virus scanning (Phase 10)
- SQL injection prevention: Drizzle ORM parameterized queries exclusively

### Transport Security
- TLS 1.2 minimum (TLS 1.3 preferred) for all HTTP traffic
- No plain HTTP endpoints in staging or production
- HSTS header on all responses

### Secrets
- All secrets read from environment variables at startup
- Application crashes on startup if required secrets are missing
- Secrets are never logged, even partially

---

## Testing Requirements

### Unit Tests (Phase 2+)
- All indicator calculations tested against reference values
- All Zod schemas tested with valid and invalid inputs
- All utility functions have unit test coverage

### Integration Tests (Phase 2+)
- API endpoints tested end-to-end
- Database operations tested against a test database
- Data provider adapters tested with recorded responses

### Backtest Reproducibility Tests (Phase 4)
- Standard strategies produce identical results across runs
- Results match manually calculated expected values for simple strategies

### Load Tests (Phase 10)
- API sustains 100 req/s for 10 minutes without degradation
- Concurrent backtests do not interfere with each other

---

## Dependency Requirements

### Approved Dependencies

| Category | Package | Version |
|----------|---------|---------|
| Framework | express | 5.x |
| ORM | drizzle-orm | latest stable |
| Validation | zod | v4 |
| Frontend | react, react-dom | 19.x |
| Build | vite | 6.x |
| Codegen | orval | latest stable |
| Logging | pino | latest stable |
| Testing | vitest | latest stable |

### Dependency Rules
- All dependencies must have > 1M weekly npm downloads or be officially maintained
- No dependency with known high/critical CVEs (enforced by `pnpm audit` in Phase 10)
- Dependencies are pinned to minor version ranges (`^x.y.0`) to allow patch updates
- Major version upgrades require an ADR entry in DECISIONS.md

---

## Development Environment Requirements

### Required Tools
- Node.js 24 LTS
- pnpm 9+
- PostgreSQL 16+ (via Replit provisioning)
- TypeScript 5.9+

### Recommended Setup
- Replit as primary development environment (see ADR-002)
- VSCode or Replit editor with TypeScript language server

### Local Environment
- `.env` file for local secrets (gitignored — use Replit Secrets panel instead)
- `pnpm install` to install all dependencies
- `pnpm run typecheck` to verify TypeScript across all packages

---

## Interoperability Requirements

### API Contracts
- All APIs conform to OpenAPI 3.1 specification
- API versioning via URL prefix (`/api/v1/`, `/api/v2/`)
- Breaking changes require a new version prefix

### Data Formats
- All timestamps are UTC ISO 8601 strings in API responses
- All monetary values are strings (not floats) to avoid floating-point precision errors
- OHLCV prices use string representation with configurable decimal precision
- Asset symbols use a normalized format: `{EXCHANGE}:{BASE}/{QUOTE}` for crypto, `{TICKER}` for stocks

### Export Formats
- Trade journal: CSV with documented column specification
- Backtest results: JSON with documented schema
- Performance reports: JSON (API) + optional PDF/HTML (Phase 7+)
