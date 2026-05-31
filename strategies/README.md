# /strategies — Strategy Definitions & Research

> Status: Not yet implemented. Planned for Phase 3.

---

## Purpose

This directory contains all strategy definitions, research documentation, and backtest configurations. Each strategy has its own subdirectory with a complete research trail.

---

## Planned Directory Structure

```
strategies/
├── README.md                          # This file
├── _templates/                        # Research document templates
│   ├── hypothesis.md                  # Strategy hypothesis template
│   ├── backtest-config.json           # Backtest configuration template
│   └── research-summary.md            # Research summary template
│
├── active/                            # Strategies in paper or live trading
│   └── (none yet)
│
├── research/                          # Strategies under development
│   └── (none yet)
│
└── archived/                          # Discontinued strategies (never deleted)
    └── (none yet)
```

---

## Strategy Lifecycle

```
Hypothesis → Research → Backtesting → Paper Trading → Live Trading
                                                          │
                                                   ┌──────┘
                                                   │
                                          Archived (if discontinued)
```

Strategies move through subdirectories as they progress. Archived strategies are never deleted — they are a record of what was tried and why it was discontinued.

---

## Strategy Research Standards

Every strategy directory must contain:

| File | Description | Required |
|------|-------------|----------|
| `hypothesis.md` | Market mechanism and why the strategy should work | ✅ |
| `data-spec.md` | Data requirements (symbols, timeframes, date range, source) | ✅ |
| `indicators.md` | Indicators used, parameters, validation methodology | ✅ |
| `backtest-config.json` | Exact backtest configuration (reproducible) | ✅ |
| `backtest-results.md` | Full performance metrics and analysis | ✅ |
| `walk-forward-results.md` | Walk-forward analysis results | ✅ |
| `risk-assessment.md` | Realistic drawdown, correlation analysis | ✅ |
| `decision.md` | Proceed/archive decision with documented reasoning | ✅ |

---

## For AI Agents

Before creating or modifying strategy files:
1. Read [AGENTS.md](../AGENTS.md)
2. Read [docs/08-TRADING_RESEARCH.md](../docs/08-TRADING_RESEARCH.md) for research methodology
3. Strategies are in Phase 3+ scope — do not create strategy files in Phase 0, 1, or 2
4. Every new strategy starts in `strategies/research/`
5. Never move a strategy to `active/` without completing all required documentation
