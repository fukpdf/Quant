# 01-VISION.md — QuantForge Vision

---

## Mission Statement

QuantForge exists to give a single disciplined operator the tools, infrastructure, and workflow of a professional quantitative trading desk — without the headcount, without the overhead, and without compromising on rigor.

It is not a get-rich-quick scheme. It is not a copy-trading platform. It is not a black-box signal service.

It is a research environment where ideas are tested honestly, strategies are validated exhaustively, risk is controlled systematically, and execution is audited completely.

---

## The Problem Being Solved

Personal systematic traders face a fundamental infrastructure gap:

| What pros have | What individuals typically use |
|---------------|-------------------------------|
| Institutional data feeds | Free APIs with rate limits and gaps |
| Event-driven backtesting engines | Simple vectorized backtests that overfit |
| Pre-trade risk management systems | Gut feel and rough position sizing |
| Portfolio analytics and attribution | Spreadsheets |
| Audit trails and compliance systems | Nothing |
| Research infrastructure | Notebooks with no version control |

QuantForge bridges this gap — not by being cheaper than institutional tools, but by being purpose-built for one operator who cares deeply about doing it right.

---

## Target User

**Primary user**: The project owner — a technically sophisticated individual trader who:

- Understands software engineering and can read and write code
- Believes quantitative methods produce more consistent results than discretionary trading
- Is not satisfied with off-the-shelf tools (TradingView, QuantConnect, etc.) due to data sovereignty, customization, or cost concerns
- Is willing to invest significant time building infrastructure in exchange for complete control
- Understands the difference between backtesting and live trading performance

**Not designed for**:
- Casual investors seeking simple interfaces
- Non-technical users
- Traders seeking fully automated AI-driven decisions
- Third-party clients

---

## Core Beliefs

1. **Discipline over excitement**: The best systematic strategy is one that is boring, well-understood, and proven across market regimes — not the most exciting one.

2. **Data quality over data quantity**: A backtest on pristine, well-understood data is worth more than a backtest on a larger dataset with survivorship bias, gaps, and errors.

3. **Risk management is the strategy**: Position sizing, drawdown control, and exposure management are as important as entry and exit signals. Possibly more important.

4. **Simulation is not reality**: Backtest and paper trading results are hypotheses about how a strategy might perform, not proof of how it will perform.

5. **Audit trails are non-negotiable**: Every decision, parameter change, and order must be reconstructable from logs. No black boxes.

6. **AI assists, humans decide**: AI tools accelerate research and catch blind spots. They do not make financial decisions.

---

## Success Criteria

The platform is successful when:

### Research Quality
- [ ] Strategies can be tested with realistic transaction costs and market impact
- [ ] Walk-forward validation is standard practice, not an afterthought
- [ ] Historical data has documented quality checks and gap reports
- [ ] Research notebooks are version-controlled and reproducible

### Operational Discipline
- [ ] No position is entered without passing all risk checks
- [ ] Every order (paper or live) has a complete audit trail
- [ ] Strategy parameters are versioned and changes are documented
- [ ] Drawdown alerts fire reliably before limits are breached

### System Reliability
- [ ] Market data ingestion has < 0.1% gap rate
- [ ] API latency (p99) < 500ms for all read endpoints
- [ ] Zero data loss events in historical storage
- [ ] Backup and recovery tested quarterly

### Development Quality
- [ ] Any future AI agent can understand the project within 5 minutes
- [ ] All phases complete their documented deliverables before the next phase begins
- [ ] No secrets ever appear in git history

---

## What Done Looks Like (Long-Term)

A typical day using the fully-built platform:

1. Morning review: Open the portfolio analytics dashboard. See overnight P&L, current positions, drawdown status, and any risk alerts.

2. Research session: Open a research notebook connected to live historical data. Test a new hypothesis. The indicator library provides building blocks; the backtesting engine provides results with realistic costs.

3. Strategy review: Walk-forward results show the strategy is robust. Submit it to paper trading. The risk engine validates the position sizing. The paper trading engine simulates fills against live market data.

4. Risk monitoring: The risk engine's dashboard shows current exposure by asset class, strategy, and position. All within configured limits.

5. Performance review: Monthly analytics report shows time-weighted return, attribution by strategy, and comparison against benchmark. The trade journal exports cleanly to a spreadsheet for tax purposes.

6. AI research session (Phase 9): Describe a market regime hypothesis to the AI assistant. It generates indicator combinations to test and flags potential data snooping risks in the approach.
