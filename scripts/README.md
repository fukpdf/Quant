# /scripts — Utility & Operational Scripts

> The workspace `scripts` package is at the root level (`scripts/`). This directory documents all available scripts and their purpose.

---

## Purpose

The scripts package (`@workspace/scripts`) contains utility scripts for:
- Database maintenance (backfill, cleanup, validation)
- Data quality checks
- Operational tasks (health checks, status reports)
- Development utilities

---

## Structure

```
scripts/
├── README.md                    # This file
├── package.json                 # @workspace/scripts package
├── tsconfig.json
└── src/
    ├── hello.ts                 # Example script (placeholder)
    └── (scripts added per phase)
```

---

## Adding a Script

1. Create the script file in `scripts/src/`
2. Add a matching npm script in `scripts/package.json`
3. Document it in this README

```json
// scripts/package.json
{
  "scripts": {
    "my-script": "tsx src/my-script.ts"
  }
}
```

Run with:
```bash
pnpm --filter @workspace/scripts run my-script
```

---

## Planned Scripts (by Phase)

### Phase 1
| Script | Purpose |
|--------|---------|
| `check-feeds` | Report status of all configured data feeds |

### Phase 2
| Script | Purpose |
|--------|---------|
| `backfill-ohlcv` | Backfill historical OHLCV data for a symbol |
| `data-quality-report` | Generate data quality report for all assets |
| `detect-gaps` | Scan OHLCV data for gaps above threshold |

### Phase 5
| Script | Purpose |
|--------|---------|
| `reset-paper-account` | Reset paper trading account to starting capital |
| `export-trade-journal` | Export paper trading journal to CSV |

### Phase 10
| Script | Purpose |
|--------|---------|
| `rotate-secrets` | Guide through secret rotation checklist |
| `health-check` | Full system health check report |
| `db-backup` | Trigger manual database backup |

---

## Script Rules

1. Scripts use TypeScript — no raw JavaScript
2. Scripts log to stdout using the shared logger
3. Scripts exit with code 0 on success, non-zero on failure
4. Scripts that modify data require explicit confirmation (except in CI mode with `--yes` flag)
5. All scripts are documented in this README before they are committed

---

## For AI Agents

Before adding scripts:
1. Read [AGENTS.md](../AGENTS.md)
2. Scripts are in scope from Phase 1 onwards
3. Follow the pattern in `scripts/src/hello.ts` for the basic structure
4. Add the script to the table above after creating it
