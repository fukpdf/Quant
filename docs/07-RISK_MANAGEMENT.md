# 07-RISK_MANAGEMENT.md — Risk Management Framework

> Status: Phase 0 outline — implementation details populated in Phase 6.

---

## Philosophy

Risk management is not a feature bolted onto a trading system — it IS the trading system. Entry and exit signals determine which opportunities are pursued. Risk management determines how much capital survives long enough to pursue them.

The risk engine enforces these principles mechanically, without emotion or override, in every market condition.

---

## Risk Hierarchy

```
Portfolio Level (highest)
  ├── Total capital at risk
  ├── Maximum portfolio drawdown (circuit breaker)
  └── Total exposure by asset class
      │
      ├── Strategy Level
      │     ├── Max allocation to strategy
      │     ├── Strategy-level drawdown limit
      │     └── Strategy circuit breaker
      │
      └── Position Level (lowest)
            ├── Maximum position size
            ├── Stop-loss enforcement
            └── Correlation-adjusted sizing
```

---

## Position Sizing Framework

### Fixed Fractional (Primary Method)

Risk a fixed percentage of current equity per trade.

```
Position Size = (Account Equity × Risk Per Trade %) / (Entry Price - Stop Price)
```

**Default parameters** (configurable via `RISK_MAX_POSITION_PCT`):
- Risk per trade: 1% of equity
- Maximum position size: 5% of equity (regardless of stop distance)
- Maximum simultaneous positions: 20 (= 5% × 20 = 100% exposure maximum)

### Volatility-Adjusted Sizing

Scale position size inversely with asset volatility (ATR-based):

```
Position Size = (Account Equity × Risk Per Trade %) / (N × ATR)
```

Where N = ATR multiplier (default: 2.0).

### Correlation-Adjusted Sizing

Reduce position size when opening correlated positions:

```
Effective Risk = Sum of (Position Risk × Correlation Coefficient) for all correlated pairs
```

If effective risk exceeds portfolio risk limit, new positions in correlated assets are rejected.

---

## Pre-Trade Risk Checks

Every order submitted to the platform (paper or live) passes ALL of these checks before execution. Failure at any check rejects the order with a documented reason.

| Check | Rule | Rejection Reason |
|-------|------|-----------------|
| Portfolio drawdown circuit breaker | Reject if current drawdown ≥ `RISK_MAX_DRAWDOWN_PCT` | `CIRCUIT_BREAKER_ACTIVE` |
| Maximum position size | Reject if position > `RISK_MAX_POSITION_PCT` × equity | `POSITION_TOO_LARGE` |
| Maximum asset-class exposure | Reject if asset class exposure ≥ 40% of portfolio | `ASSET_CLASS_LIMIT_EXCEEDED` |
| Single-asset maximum | Reject if single asset exposure ≥ 10% of portfolio | `SINGLE_ASSET_LIMIT_EXCEEDED` |
| Strategy allocation limit | Reject if strategy allocation ≥ 30% of portfolio | `STRATEGY_LIMIT_EXCEEDED` |
| Correlation exposure | Reject if correlated exposure ≥ 15% of portfolio | `CORRELATION_LIMIT_EXCEEDED` |
| Available capital | Reject if insufficient buying power | `INSUFFICIENT_CAPITAL` |
| Duplicate position | Warn (not reject) if adding to existing position beyond limit | `DUPLICATE_POSITION_WARNING` |

---

## Post-Trade Monitoring

### Real-Time Monitoring (Phase 6)

| Metric | Check Frequency | Alert Threshold |
|--------|----------------|-----------------|
| Portfolio drawdown | Per fill event | 50% of max drawdown limit |
| Strategy drawdown | Per fill event | 50% of strategy limit |
| Asset class exposure | Per fill event | 80% of exposure limit |
| Single asset exposure | Per fill event | 80% of single-asset limit |
| Open position count | Per fill event | 90% of maximum |

### Circuit Breakers

**Portfolio Circuit Breaker**:
- Triggers when portfolio drawdown ≥ `RISK_MAX_DRAWDOWN_PCT`
- Effect: Rejects ALL new orders until manually reset
- Reset: Requires explicit operator action (not automatic)
- Logged as `CIRCUIT_BREAKER_ACTIVATED` in audit log

**Strategy Circuit Breaker**:
- Triggers when strategy drawdown ≥ strategy-specific limit
- Effect: Rejects new orders for that strategy only
- Reset: Requires explicit operator action per strategy

---

## Risk Configuration

### Default Risk Parameters

All parameters are configurable via environment variables and database configuration. Defaults below are starting points, not recommendations.

```
Portfolio level:
  max_drawdown_pct:           0.15   (15% drawdown → circuit breaker)
  max_single_asset_pct:       0.10   (10% max single asset)
  max_asset_class_pct:        0.40   (40% max per asset class)
  max_strategy_pct:           0.30   (30% max per strategy)
  max_correlated_exposure:    0.15   (15% max correlated exposure)

Position level:
  risk_per_trade_pct:         0.01   (1% equity risk per trade)
  max_position_pct:           0.05   (5% max position size)
  max_open_positions:         20

Strategy level:
  max_strategy_drawdown_pct:  0.10   (10% strategy drawdown → strategy circuit breaker)
```

---

## Risk Reporting

### Daily Risk Report (Phase 7)

Generated automatically at end of each trading day:

- Portfolio drawdown from high water mark
- Exposure by asset class
- Exposure by strategy
- Open position count and total exposure
- Circuit breaker status
- Risk limit utilization (%) per limit
- Near-limit warnings (> 80% of any limit)

### Trade Risk Summary (Per Order)

Logged with every order:

- Risk check results (all checks, pass/fail)
- Position size and percent of portfolio
- Estimated risk (position × stop distance)
- Portfolio exposure after fill (projected)

---

## Risk Model Limitations

The following limitations must be understood and accepted:

1. **Backtested risk parameters are optimistic**: Real-world execution will face wider spreads, gaps, and liquidity constraints not captured in historical data.

2. **Correlation is not static**: Asset correlations change in stress periods. A portfolio that appears diversified in normal markets may be highly correlated in a crisis.

3. **Stop-losses are not guaranteed**: In fast markets, stops may fill at worse prices than specified (slippage). The risk engine estimates risk based on stop price, not guaranteed fill price.

4. **Model risk**: The risk model itself may be wrong. Risk limits should be treated as necessary but not sufficient controls.

5. **Black swan events**: Extreme tail events (exchange failures, trading halts, extreme gaps) are not fully modeled. The circuit breaker provides a last line of defense.

---

## Risk Governance

### Configuration Changes

Any change to risk parameters (limits, circuit breaker thresholds) must:
1. Be made via the configuration interface, not by editing code
2. Be logged in the audit log (`RISK_CONFIG_CHANGED` event)
3. Record the old and new values
4. Record the reason for the change

### Circuit Breaker Reset

The circuit breaker cannot be reset automatically. To reset:
1. The drawdown condition must be reviewed
2. An explicit reset action must be taken via the risk API
3. The reset is logged in the audit log with a required reason field

### Risk Overrides

There are no risk overrides. An order that fails a risk check is rejected. The correct response to a rejected order is to:
- Reduce position size
- Improve stop placement
- Reduce existing exposure before adding new positions
- If the risk limit itself is wrong, change the limit via the configuration interface (with audit log)
