# /tests — Test Suites

> Status: Test infrastructure planned for Phase 2. Phase 0 is foundation only.

---

## Purpose

This directory contains integration tests, end-to-end tests, and shared test utilities. Unit tests live alongside their source files within each workspace package.

---

## Planned Structure

```
tests/
├── README.md                          # This file
├── integration/                       # Integration tests
│   ├── api/                           # API endpoint tests
│   ├── database/                      # Database operation tests
│   └── data-providers/                # Data provider adapter tests
│
├── e2e/                               # End-to-end tests (Phase 5+)
│   ├── paper-trading/                 # Paper trading flow tests
│   └── risk-engine/                   # Risk check validation tests
│
├── fixtures/                          # Shared test fixtures
│   ├── market-data/                   # Sample OHLCV data (small datasets)
│   └── strategies/                    # Sample strategy configurations
│
└── helpers/                           # Shared test utilities
    ├── database.ts                     # Test database setup/teardown
    ├── api-client.ts                   # Test API client
    └── market-data.ts                  # Market data generation utilities
```

---

## Test Framework

**Framework**: Vitest

Vitest is the chosen test runner for all packages in this monorepo. It is fast, TypeScript-native, and compatible with the pnpm workspace setup.

---

## Test Categories

### Unit Tests (Phase 2+)
- Location: Alongside source files in each package (`src/*.test.ts`)
- Run: `pnpm --filter @workspace/<package> run test`
- Scope: Individual functions and modules in isolation

### Integration Tests (Phase 2+)
- Location: `tests/integration/`
- Run: `pnpm --filter @workspace/tests run test:integration`
- Scope: API endpoints, database operations, external adapters
- Requires: Test database instance

### Backtest Reproducibility Tests (Phase 4+)
- Verify identical outputs for identical inputs
- Run against known datasets with pre-computed expected results

### End-to-End Tests (Phase 5+)
- Location: `tests/e2e/`
- Scope: Complete paper trading and risk engine flows

---

## Test Database

Integration tests use a separate test database:
- Automatically created at test start
- Schema applied via Drizzle migrations
- Seeded with fixture data
- Destroyed at test end (or reset between test suites)

Required env variable for tests:
```
DATABASE_URL_TEST=postgresql://user:password@host:port/quantforge_test
```

---

## Running Tests

```bash
# All tests (Phase 2+)
pnpm run test

# Unit tests for a specific package
pnpm --filter @workspace/api-server run test

# Integration tests
pnpm --filter @workspace/tests run test:integration

# Watch mode (during development)
pnpm --filter @workspace/<package> run test:watch
```

---

## Testing Rules

1. No test uses real exchange API credentials — use recorded responses (fixtures)
2. Backtest tests must be fully deterministic — no random seeds without explicit seeding
3. Integration tests must clean up after themselves
4. Test coverage is a signal, not a goal — meaningful tests over coverage percentage
5. Do not test implementation details — test behavior and contracts

---

## For AI Agents

Before writing tests:
1. Read [AGENTS.md](../AGENTS.md)
2. Testing infrastructure begins in Phase 2 — do not create test infrastructure in Phase 0 or 1
3. Unit tests go alongside source files (e.g., `src/indicators/rsi.test.ts`)
4. Integration tests go in `tests/integration/`
5. All tests must pass before a phase is marked complete (Phase 2+)
