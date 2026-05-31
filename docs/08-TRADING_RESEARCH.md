# 08-TRADING_RESEARCH.md — Trading Research Methodology

> Status: Phase 0 outline — research workflows and strategy library populated as Phase 3 begins.

---

## Research Philosophy

Good quantitative research starts with a hypothesis rooted in market microstructure, behavioral finance, or structural market features — not in data mining patterns that happen to work in backtests.

The research process enforces a strict separation between:
- **In-sample period**: Where the strategy is developed and parameters are optimized
- **Out-of-sample period**: Where the strategy is validated — the data it never saw during development
- **Live paper trading**: Where real-time behavior is validated before any capital is risked

A strategy that cannot survive this gauntlet does not proceed.

---

## Research Workflow

```
1. Hypothesis Formation
   └── Start with a market mechanism, not a pattern
   └── "Why would this work? What market inefficiency does it exploit?"

2. Data Assembly
   └── Identify required data (symbols, timeframes, date range)
   └── Run data quality check — document any gaps or anomalies
   └── Document data assumptions (survivorship bias, adjusted prices, etc.)

3. Indicator / Feature Development
   └── Build indicators in the shared indicator library (reusable)
   └── Validate indicator values against reference implementations
   └── Document indicator logic and parameters

4. In-Sample Research (60% of data)
   └── Develop entry, exit, and filter conditions
   └── Preliminary parameter selection
   └── Basic sanity checks (does it trade in the right direction?)

5. Out-of-Sample Validation (40% of data — never touched during step 4)
   └── Run the strategy unchanged on held-out data
   └── Performance should be reasonably close to in-sample (not identical)
   └── Significant degradation = likely overfitting → back to step 3

6. Walk-Forward Analysis
   └── Rolling window optimization and validation across full dataset
   └── Checks if parameters generalize or are period-specific

7. Robustness Testing
   └── Sensitivity analysis: how much does performance change with ±10% parameter variation?
   └── Monte Carlo simulation: what is the realistic distribution of outcomes?
   └── Worst-case scenario: what does a 2-sigma drawdown look like?

8. Cost & Execution Analysis
   └── Include realistic commissions, spreads, and slippage
   └── Minimum trade size vs. position sizing requirements
   └── Liquidity assessment at target position sizes

9. Paper Trading
   └── Strategy runs against live data for minimum 30 trading days before live
   └── Live behavior must be consistent with walk-forward expectations
   └── Any anomaly triggers a review before proceeding

10. Approval for Live Trading
    └── All steps documented and archived
    └── Risk parameters explicitly set and tested
    └── Kill switch and monitoring in place
```

---

## Strategy Classification

### By Market Regime

| Strategy Type | Description | Best Market Condition |
|---------------|-------------|----------------------|
| Trend Following | Ride sustained directional moves | Trending markets |
| Mean Reversion | Fade moves back to statistical mean | Range-bound markets |
| Momentum | Buy recent winners, sell recent losers | Trending with momentum |
| Breakout | Enter on price breaking key levels | Consolidation into breakout |
| Carry | Profit from interest rate differentials | Low volatility, stable |
| Volatility | Trade volatility expansion/contraction | Regime-agnostic |
| Market Making | Profit from bid-ask spread | High liquidity |

### By Timeframe

| Timeframe | Description | Typical Hold Period |
|-----------|-------------|-------------------|
| Scalping | Very short, multiple trades per day | Seconds to minutes |
| Intraday | Within a single trading session | Minutes to hours |
| Swing | Multi-day moves | Days to weeks |
| Position | Longer-term moves | Weeks to months |

QuantForge initially focuses on **swing and position** timeframes where data quality and execution costs are more manageable for a personal platform.

---

## Asset Class Research Considerations

### Cryptocurrency
- 24/7 markets with no official close — define a consistent daily bar close time
- Spot vs. perpetual futures pricing divergence
- Funding rates affect strategy profitability on leveraged positions
- Exchange-specific liquidity and order book depth varies significantly
- No centralized pricing — choose primary reference exchange explicitly

### Forex
- Market hours span sessions: Sydney, Tokyo, London, New York
- Major, minor, and exotic pair liquidity varies dramatically
- Interest rate differentials affect carry strategies
- Central bank intervention creates regime breaks
- Bid-ask spreads vary by session and liquidity

### Stocks
- Survivorship bias in historical data — document data source carefully
- Corporate actions (splits, dividends) require adjusted price series
- Sector rotation and correlation with indices affects individual stock strategies
- Earnings and economic calendar events create volatility regimes

### Indices
- Cannot be directly held — traded via ETFs, futures, or CFDs
- Cost of carry for futures-based strategies
- Roll yield for futures positions
- Very high correlation with macro factors

### Commodities
- Seasonal patterns in physical commodities
- Supply/demand fundamentals drive longer-term trends
- Contango and backwardation affect futures-based strategies
- Storage costs and convenience yields

---

## Indicator Library (Phase 3)

### Planned Core Indicators

| Category | Indicators |
|----------|-----------|
| Trend | SMA, EMA, DEMA, TEMA, KAMA, ALMA, Hull MA |
| Momentum | RSI, Stochastic, MACD, ROC, Momentum, CCI, Williams %R |
| Volatility | ATR, Bollinger Bands, Keltner Channels, Historical Vol, IV Rank |
| Volume | OBV, VWAP, Volume Profile, Accumulation/Distribution, CMF |
| Support/Resistance | Pivot Points, Fibonacci Levels, Donchian Channels |
| Statistical | Correlation, Beta, Z-score, Percentile Rank |

### Indicator Standards

Every indicator in the library must:
1. Have a documented mathematical definition
2. Have validated output against a reference implementation (Python's TA-Lib or pandas-ta)
3. Handle edge cases (insufficient data, NaN values, zero volume)
4. Accept configurable parameters with documented defaults
5. Be registered in the indicator catalog API endpoint

---

## Common Research Mistakes to Avoid

### Data Snooping / Look-Ahead Bias
- Never use future data in signal calculation (even accidentally via shifted dataframes)
- Backtesting engine uses an event-driven model to prevent this mechanically
- Walk-forward analysis is mandatory, not optional

### Overfitting
- Strategies with many parameters are suspect — too many degrees of freedom
- In-sample / out-of-sample performance gap > 30% is a red flag
- Sensitivity analysis: if ±10% parameter changes cause large performance swings, the strategy is fragile

### Survivorship Bias
- Historical stock universes must include delisted securities
- Cryptocurrency universes have extreme survivor bias — document the data source's coverage
- Index composition changes over time must be accounted for

### Transaction Cost Underestimation
- Always use realistic commissions, not zero
- Bid-ask spread matters especially for short-term strategies
- Slippage scales with position size relative to daily volume
- Financing costs for leveraged or overnight positions

### Small Sample Bias
- A strategy with 20 trades has high uncertainty in all metrics
- Minimum: 200+ trades for any statistical significance
- Minimum: 3+ market regime changes in the backtest period

---

## Research Documentation Standards

Every research project must produce:

1. **Hypothesis Document**: What market mechanism does this strategy exploit? Why does it work?
2. **Data Specification**: Symbols, timeframes, date range, data source, known quality issues
3. **Indicator Documentation**: Formulas, parameters, validation methodology
4. **Backtest Configuration**: Exact parameters used (reproducible)
5. **Results Summary**: Full performance metrics, equity curve, drawdown analysis
6. **Walk-Forward Report**: Rolling window performance
7. **Risk Assessment**: Maximum realistic drawdown, correlation with existing strategies
8. **Decision**: Proceed to paper trading / back to research / abandoned (with reason)

All research documents are version-controlled in the `/strategies` directory.
