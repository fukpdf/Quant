---
name: BacktestRequest interface fields
description: "BacktestRequest in research-runner.ts uses interval (not timeframe) and params (not parameters); StrategyParams comes from ../strategies/types not research-runner"
---

## Rule
When calling `executeBacktest()` from `research-runner.ts`, use the correct field names:

```typescript
const result = await executeBacktest({
  strategyName: "...",
  symbol: "BTCUSDT",
  interval: "1h",               // NOT timeframe
  startDate: new Date("..."),   // Date object, not string
  endDate: new Date("..."),     // Date object, not string
  initialCapital: 10000,        // number, not "10000" string
  params: { ... } as Partial<import("../strategies/types").StrategyParams>,  // NOT parameters
});
```

**Why:** BacktestRequest interface uses `interval` and `params` (matching the Binance naming convention). StrategyParams is exported from `../strategies/types`, NOT re-exported from `research-runner`.

**How to apply:** Any optimizer or genetic algorithm service that calls executeBacktest must use these exact field names.
