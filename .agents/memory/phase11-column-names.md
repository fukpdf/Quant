---
name: Phase 11 schema column names
description: "Correct column names for DB tables used in Phase 11 services — several intuitive names don't exist"
---

## Column Name Map

| What you might write | Actual column | Table |
|---|---|---|
| `tradeCount` | `totalTrades` | `performance_metrics` |
| `openTime` | `timestamp` | `candles` |
| `efficiencyRatio` | `consistencyScore` | `walk_forward_runs` |
| `medianFinalEquity` | `medianReturn` | `monte_carlo_runs` |
| `initialCapital` | does NOT exist | `backtest_runs` |
| `backtestRunId` | does NOT exist | `walk_forward_runs` (join on `strategyName` instead) |

**Why:** Phase 11 services were written before the schema was finalized, and several column names were guessed incorrectly. The actual schema uses more precise names.

**How to apply:** Before referencing a column in a new service, grep the schema file to confirm the actual column name.
