# 05-DATABASE_ARCHITECTURE.md — Database Architecture

> Status: Phase 0 outline — schema details populated as each phase begins.

---

## Technology Choice

**Primary Database**: PostgreSQL 16+
**ORM**: Drizzle ORM
**Schema Validation**: drizzle-zod (Zod schemas derived from Drizzle schema)
**Migrations**: Drizzle Kit

See ADR-003 for the rationale behind choosing PostgreSQL over alternatives.

---

## Design Principles

1. **Single source of truth**: All data lives in PostgreSQL. No polyglot persistence until a proven bottleneck justifies it.
2. **Schema changes via migrations**: Never alter the database manually. Every schema change goes through a Drizzle migration file.
3. **Reversible migrations**: Every migration must have a `down` path.
4. **Type-safe access only**: No raw SQL in application code. Drizzle ORM exclusively.
5. **Indexes are intentional**: Every index must have a documented rationale. Unindexed tables are acceptable when access patterns are read-light.
6. **Nullable columns need a reason**: Every nullable column has a documented reason for allowing null. Default is NOT NULL.
7. **Timestamps are UTC always**: All timestamp columns store UTC. No timezone conversion in the database.
8. **Monetary values as strings**: All price and quantity values stored as DECIMAL or NUMERIC — never FLOAT. Fetched as strings by Drizzle to avoid JavaScript float imprecision.

---

## Schema Location

All Drizzle schema files live in `lib/db/src/schema/`.

```
lib/db/src/schema/
├── index.ts              # Barrel export of all schemas
├── assets.ts             # Asset catalog (Phase 1)
├── ohlcv.ts              # OHLCV time-series data (Phase 2)
├── strategies.ts         # Strategy definitions (Phase 3)
├── paper_trades.ts       # Paper trading records (Phase 5)
├── risk_config.ts        # Risk engine configuration (Phase 6)
├── portfolio.ts          # Portfolio and position records (Phase 7)
└── audit_log.ts          # Audit trail (Phase 5+)
```

---

## Table Catalog

### Phase 1 Tables

#### `assets`
The catalog of all tradable assets in the system.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NOT NULL | Primary key |
| symbol | varchar(50) | NOT NULL | Normalized symbol (e.g., `BTC/USDT`, `AAPL`) |
| exchange | varchar(50) | NOT NULL | Exchange or data provider identifier |
| asset_class | varchar(20) | NOT NULL | `crypto`, `forex`, `stock`, `index`, `commodity` |
| base_currency | varchar(20) | NOT NULL | Base currency (e.g., `BTC`, `EUR`) |
| quote_currency | varchar(20) | NOT NULL | Quote currency (e.g., `USDT`, `USD`) |
| is_active | boolean | NOT NULL | Whether currently ingesting data |
| created_at | timestamptz | NOT NULL | When added to catalog |
| updated_at | timestamptz | NOT NULL | Last metadata update |

**Indexes**: `(exchange, symbol)` UNIQUE; `(asset_class)` for filtering

#### `data_providers`
Registry of all connected market data providers.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NOT NULL | Primary key |
| name | varchar(100) | NOT NULL | Provider name |
| provider_type | varchar(50) | NOT NULL | `rest`, `websocket`, `file` |
| asset_classes | text[] | NOT NULL | Array of asset classes supported |
| status | varchar(20) | NOT NULL | `active`, `degraded`, `inactive` |
| last_heartbeat | timestamptz | NULL | Last successful data receipt |
| created_at | timestamptz | NOT NULL | When registered |

---

### Phase 2 Tables

#### `ohlcv_data`
Core OHLCV time-series table. This is the largest table in the system.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | bigserial | NOT NULL | Surrogate key |
| asset_id | uuid | NOT NULL | Foreign key → assets.id |
| timeframe | varchar(10) | NOT NULL | `1m`, `5m`, `15m`, `1h`, `4h`, `1d`, etc. |
| open_time | timestamptz | NOT NULL | Bar open timestamp (UTC) |
| open | numeric(20,8) | NOT NULL | Open price |
| high | numeric(20,8) | NOT NULL | High price |
| low | numeric(20,8) | NOT NULL | Low price |
| close | numeric(20,8) | NOT NULL | Close price |
| volume | numeric(30,8) | NOT NULL | Volume in base currency |
| source | varchar(50) | NOT NULL | Data provider that supplied this bar |
| created_at | timestamptz | NOT NULL | When ingested |

**Partitioning**: Partitioned by `open_time` (range, monthly) to support efficient time-range queries and data retention.

**Indexes**:
- `(asset_id, timeframe, open_time)` UNIQUE — primary query pattern
- `(open_time)` — partition key (implicit)

**Note on storage**: 10 years × 500 symbols × 1440 1m-bars/day = ~2.6B rows. Partitioning is essential.

#### `data_quality_log`
Records data quality events (gaps, outliers, backfills).

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NOT NULL | Primary key |
| asset_id | uuid | NOT NULL | Foreign key → assets.id |
| timeframe | varchar(10) | NOT NULL | Affected timeframe |
| event_type | varchar(30) | NOT NULL | `gap`, `outlier`, `backfill`, `duplicate` |
| period_start | timestamptz | NOT NULL | Start of affected period |
| period_end | timestamptz | NOT NULL | End of affected period |
| details | jsonb | NULL | Additional event details |
| resolved | boolean | NOT NULL | Whether the issue was resolved |
| created_at | timestamptz | NOT NULL | When detected |

---

### Phase 3 Tables

#### `strategies`
Strategy definitions and configurations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NOT NULL | Primary key |
| name | varchar(100) | NOT NULL | Human-readable name |
| description | text | NULL | Strategy description |
| strategy_type | varchar(50) | NOT NULL | `trend_following`, `mean_reversion`, etc. |
| parameters | jsonb | NOT NULL | Strategy parameters (versioned) |
| version | integer | NOT NULL | Parameter version (incremented on change) |
| status | varchar(20) | NOT NULL | `research`, `backtesting`, `paper`, `live` |
| created_at | timestamptz | NOT NULL | Creation timestamp |
| updated_at | timestamptz | NOT NULL | Last parameter update |

---

### Phase 5 Tables

#### `paper_orders`
All paper trading orders.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | uuid | NOT NULL | Primary key |
| strategy_id | uuid | NOT NULL | Foreign key → strategies.id |
| asset_id | uuid | NOT NULL | Foreign key → assets.id |
| order_type | varchar(20) | NOT NULL | `market`, `limit`, `stop` |
| side | varchar(10) | NOT NULL | `buy`, `sell` |
| quantity | numeric(20,8) | NOT NULL | Order quantity |
| limit_price | numeric(20,8) | NULL | For limit orders |
| stop_price | numeric(20,8) | NULL | For stop orders |
| status | varchar(20) | NOT NULL | `pending`, `open`, `filled`, `cancelled`, `rejected` |
| filled_quantity | numeric(20,8) | NOT NULL | Quantity filled so far |
| avg_fill_price | numeric(20,8) | NULL | Average fill price |
| commission | numeric(20,8) | NOT NULL | Commission charged |
| slippage | numeric(20,8) | NOT NULL | Slippage applied |
| risk_check_result | jsonb | NOT NULL | Risk engine response |
| submitted_at | timestamptz | NOT NULL | When submitted |
| filled_at | timestamptz | NULL | When fully filled |

---

### Phase 5+ Tables

#### `audit_log`
Immutable audit trail for all sensitive operations.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| id | bigserial | NOT NULL | Surrogate key |
| event_type | varchar(100) | NOT NULL | Event category |
| actor | varchar(100) | NOT NULL | Who triggered the event |
| resource_type | varchar(50) | NOT NULL | What was affected |
| resource_id | uuid | NULL | ID of affected resource |
| before_state | jsonb | NULL | State before change |
| after_state | jsonb | NULL | State after change |
| metadata | jsonb | NULL | Additional context |
| created_at | timestamptz | NOT NULL | Event timestamp |

**Important**: This table is append-only. No UPDATE or DELETE operations are ever permitted.

---

## Partitioning Strategy

### `ohlcv_data` Partitioning

Partition by `open_time` using PostgreSQL range partitioning, monthly intervals:

```sql
-- Parent table
CREATE TABLE ohlcv_data (...) PARTITION BY RANGE (open_time);

-- Monthly partitions (created automatically by application)
CREATE TABLE ohlcv_data_2024_01 PARTITION OF ohlcv_data
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

Partition management:
- New partitions created 3 months ahead by a scheduled maintenance job
- Old partitions can be archived (detached + compressed) after a retention period
- Partition pruning ensures queries touch only relevant partitions

---

## Migration Workflow

```bash
# 1. Edit schema files in lib/db/src/schema/
# 2. Generate migration
pnpm --filter @workspace/db run generate

# 3. Review generated SQL in lib/db/drizzle/ directory

# 4. Apply migration (dev)
pnpm --filter @workspace/db run push

# 5. Apply migration (production) — via migration script in CI/CD
pnpm --filter @workspace/db run migrate
```

---

## Backup Strategy (Phase 2)

| Backup Type | Frequency | Retention | Storage |
|-------------|-----------|-----------|---------|
| Full backup | Daily | 30 days | Object storage |
| Transaction log | Continuous | 7 days | Object storage |
| Pre-migration snapshot | Per migration | Indefinite | Object storage |

Recovery testing: Restore from backup and validate row counts quarterly.
