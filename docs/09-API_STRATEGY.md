# 09-API_STRATEGY.md — API Strategy

> Status: Phase 0 outline — endpoint catalog populated as each phase begins.

---

## Design Principles

1. **Contract-first**: The OpenAPI spec in `lib/api-spec/openapi.yaml` is written before implementation code. The spec is the source of truth.
2. **Versioned from day one**: All endpoints live under `/api/v1/`. Breaking changes require a new version prefix.
3. **Consistent response shape**: All endpoints return a consistent JSON structure.
4. **Fail explicitly**: 4xx and 5xx responses include machine-readable error codes and human-readable messages.
5. **No breaking changes without versioning**: Old endpoints are deprecated (documented + `Deprecated: true` in spec) before removal — never removed without a version bump.
6. **Generated clients only**: Frontend never writes raw fetch calls. Orval generates React Query hooks from the spec.

---

## Base URL Structure

```
Development:  http://localhost:{PORT}/api/v1/
Production:   https://{domain}/api/v1/
```

All paths include the `/api` prefix (Replit proxy path) and version prefix `/v1/`.

---

## Response Format

### Success Response

```json
{
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Paginated Success Response

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 1247,
    "totalPages": 25
  },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-01-01T00:00:00.000Z"
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ ... ],
    "requestId": "uuid"
  }
}
```

---

## Error Codes

| HTTP Status | Error Code | Meaning |
|-------------|-----------|---------|
| 400 | `VALIDATION_ERROR` | Request body or params failed Zod validation |
| 400 | `INVALID_TIMEFRAME` | Timeframe string not in allowed set |
| 400 | `INVALID_DATE_RANGE` | Start date after end date |
| 404 | `ASSET_NOT_FOUND` | Symbol not in asset catalog |
| 404 | `STRATEGY_NOT_FOUND` | Strategy ID not found |
| 409 | `DUPLICATE_ASSET` | Asset already exists in catalog |
| 422 | `RISK_CHECK_FAILED` | Order rejected by risk engine |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Downstream service unreachable |

---

## Authentication (Phase 8)

All endpoints except `/api/healthz` require authentication in Phase 8+.

Authentication via JWT in HttpOnly cookie:
```
Cookie: session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Or via Bearer token in Authorization header (for API access):
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Endpoint Catalog

### System Endpoints (Phase 0)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/healthz` | Health check | ✅ Implemented |

#### `GET /api/healthz`
Returns service health status.

**Response 200:**
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 12345
}
```

---

### Asset Endpoints (Phase 1)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/v1/assets` | List all assets in catalog | ⬜ Planned |
| POST | `/api/v1/assets` | Add asset to catalog | ⬜ Planned |
| GET | `/api/v1/assets/:symbol` | Get asset details | ⬜ Planned |
| PATCH | `/api/v1/assets/:symbol` | Update asset metadata | ⬜ Planned |

### Market Data Endpoints (Phase 1)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/v1/market/quote/:symbol` | Latest quote for symbol | ⬜ Planned |
| GET | `/api/v1/market/ohlcv/:symbol` | OHLCV bars (with date range + timeframe) | ⬜ Planned |
| GET | `/api/v1/feeds/status` | Data feed health per provider | ⬜ Planned |

#### `GET /api/v1/market/ohlcv/:symbol`

**Query Parameters:**
- `timeframe` (required): `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`, `1w`
- `start` (required): ISO 8601 datetime
- `end` (optional): ISO 8601 datetime (defaults to now)
- `limit` (optional): max bars to return (default: 500, max: 5000)

**Response 200:**
```json
{
  "data": {
    "symbol": "BTC/USDT",
    "exchange": "BINANCE",
    "timeframe": "1d",
    "bars": [
      {
        "openTime": "2024-01-01T00:00:00.000Z",
        "open": "42000.00",
        "high": "43500.00",
        "low": "41800.00",
        "close": "43100.00",
        "volume": "15234.56"
      }
    ]
  },
  "meta": { "requestId": "...", "timestamp": "..." }
}
```

---

### Research Endpoints (Phase 3)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/v1/research/indicators` | List available indicators | ⬜ Planned |
| POST | `/api/v1/research/compute` | Compute indicator on dataset | ⬜ Planned |
| POST | `/api/v1/research/correlations` | Compute correlation matrix | ⬜ Planned |

---

### Strategy Endpoints (Phase 3)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/v1/strategies` | List all strategies | ⬜ Planned |
| POST | `/api/v1/strategies` | Create strategy | ⬜ Planned |
| GET | `/api/v1/strategies/:id` | Get strategy details | ⬜ Planned |
| PATCH | `/api/v1/strategies/:id` | Update strategy (creates new version) | ⬜ Planned |
| DELETE | `/api/v1/strategies/:id` | Soft-delete strategy | ⬜ Planned |

---

### Backtesting Endpoints (Phase 4)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/v1/backtests` | Submit backtest job | ⬜ Planned |
| GET | `/api/v1/backtests` | List backtest runs | ⬜ Planned |
| GET | `/api/v1/backtests/:id` | Get backtest results | ⬜ Planned |
| GET | `/api/v1/backtests/:id/trades` | Get individual trades from backtest | ⬜ Planned |
| GET | `/api/v1/backtests/:id/equity-curve` | Get equity curve data | ⬜ Planned |

---

### Paper Trading Endpoints (Phase 5)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/v1/paper/account` | Paper account summary | ⬜ Planned |
| GET | `/api/v1/paper/positions` | Current paper positions | ⬜ Planned |
| POST | `/api/v1/paper/orders` | Submit paper order | ⬜ Planned |
| GET | `/api/v1/paper/orders` | List paper orders | ⬜ Planned |
| GET | `/api/v1/paper/orders/:id` | Get order details | ⬜ Planned |
| DELETE | `/api/v1/paper/orders/:id` | Cancel open paper order | ⬜ Planned |

---

### Risk Engine Endpoints (Phase 6)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| POST | `/api/v1/risk/check` | Pre-trade risk validation (dry-run) | ⬜ Planned |
| GET | `/api/v1/risk/exposure` | Current exposure report | ⬜ Planned |
| GET | `/api/v1/risk/limits` | Current risk limit configuration | ⬜ Planned |
| PATCH | `/api/v1/risk/limits` | Update risk limits (audited) | ⬜ Planned |
| POST | `/api/v1/risk/circuit-breaker/reset` | Reset circuit breaker (audited) | ⬜ Planned |

---

### Analytics Endpoints (Phase 7)

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/v1/analytics/performance` | Portfolio performance summary | ⬜ Planned |
| GET | `/api/v1/analytics/attribution` | Return attribution by strategy/asset | ⬜ Planned |
| GET | `/api/v1/analytics/drawdown` | Drawdown analysis | ⬜ Planned |
| GET | `/api/v1/analytics/trades` | Trade journal (paginated) | ⬜ Planned |
| GET | `/api/v1/analytics/trades/export` | Export trade journal as CSV | ⬜ Planned |

---

## Codegen Workflow

After any change to `lib/api-spec/openapi.yaml`:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This generates:
- `lib/api-client-react/src/generated/api.ts` — React Query hooks
- `lib/api-zod/src/generated/api.ts` — Zod schemas

Do NOT edit generated files manually. Re-run codegen after any spec change.

---

## API Versioning Policy

| Scenario | Action |
|----------|--------|
| Adding new endpoint | Add to current version (`v1`) — non-breaking |
| Adding optional field to response | Add to current version — non-breaking |
| Adding optional query param | Add to current version — non-breaking |
| Removing field from response | Create `v2` endpoint; deprecate `v1` |
| Changing field type or name | Create `v2` endpoint; deprecate `v1` |
| Removing endpoint | Deprecate in `v1` for one phase; remove in `v2` |
| Adding required field to request | Create `v2` endpoint; deprecate `v1` |
