# /database — Database Documentation & Utilities

> The Drizzle ORM schema lives in `lib/db/`. This directory holds database documentation, seed scripts, and maintenance utilities.

---

## Purpose

This directory contains:
- Database migration documentation
- Seed data scripts
- Database maintenance scripts
- Query examples and patterns
- Performance tuning notes

---

## Database Schema Location

All Drizzle schema files are in:
```
lib/db/src/schema/
├── index.ts              # Barrel export
└── (schema files added per phase)
```

The Drizzle config:
```
lib/db/drizzle.config.ts
```

---

## Common Commands

```bash
# Push schema changes to dev database
pnpm --filter @workspace/db run push

# Generate migration files
pnpm --filter @workspace/db run generate

# Run migrations (production path — Phase 10)
pnpm --filter @workspace/db run migrate

# Type check
pnpm --filter @workspace/db run typecheck
```

---

## Database Architecture

See [docs/05-DATABASE_ARCHITECTURE.md](../docs/05-DATABASE_ARCHITECTURE.md) for:
- Table catalog and schema definitions
- Partitioning strategy for OHLCV data
- Indexing rationale
- Backup strategy
- Migration workflow

---

## Environment Variables

The database connection requires:
```
DATABASE_URL=postgresql://user:password@host:port/database
```

Set via Replit Secrets in development. Never in a `.env` file committed to git.

---

## Design Rules

- All schema changes via Drizzle migrations — never manual ALTER TABLE
- Every migration has a reversible down path
- No raw SQL in application code — Drizzle ORM exclusively
- All monetary/price values use NUMERIC, not FLOAT
- All timestamps stored in UTC
- All schema changes documented in docs/05-DATABASE_ARCHITECTURE.md

---

## For AI Agents

Before modifying the database schema:
1. Read [AGENTS.md](../AGENTS.md)
2. Read docs/05-DATABASE_ARCHITECTURE.md
3. Edit schema files in `lib/db/src/schema/`
4. Run `pnpm --filter @workspace/db run push` (dev only)
5. Update docs/05-DATABASE_ARCHITECTURE.md with the new table/column documentation
6. Add a CHANGELOG.md entry
