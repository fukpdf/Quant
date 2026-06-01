import type { ILlmProvider, LlmMessage, LlmRequestOptions, LlmResponse } from "../ai-types";

/**
 * MockLlmProvider — deterministic, zero-cost LLM provider for testing and fallback.
 *
 * Returns structured analytical responses based on the last user message content.
 * All responses are clearly labelled as mock/simulated so operators know when a
 * real provider is not configured.
 *
 * This provider:
 * - Requires no API key
 * - Returns instantly (with a 50ms simulated latency)
 * - Produces deterministic responses keyed on query keywords
 * - Counts tokens by simple word count estimation
 */
export class MockLlmProvider implements ILlmProvider {
  readonly name = "mock" as const;
  readonly defaultModel = "mock-v1";

  async complete(messages: LlmMessage[], _options?: LlmRequestOptions): Promise<LlmResponse> {
    const start = Date.now();

    // Simulate a small latency
    await new Promise((resolve) => setTimeout(resolve, 50));

    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const systemMessage = messages.find((m) => m.role === "system")?.content ?? "";

    const response = this.generateResponse(lastUserMessage, systemMessage);

    const promptTokens = this.estimateTokens(messages.map((m) => m.content).join(" "));
    const completionTokens = this.estimateTokens(response);

    return {
      content: response,
      model: this.defaultModel,
      provider: "mock",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estimatedCostUsd: 0,
      },
      latencyMs: Date.now() - start,
    };
  }

  private generateResponse(userMessage: string, systemContext: string): string {
    const lower = userMessage.toLowerCase();

    if (lower.includes("portfolio") && lower.includes("performance")) {
      return this.portfolioPerformanceResponse();
    }
    if (lower.includes("drawdown")) {
      return this.drawdownResponse();
    }
    if (lower.includes("strategy") && (lower.includes("best") || lower.includes("compare"))) {
      return this.strategyComparisonResponse();
    }
    if (lower.includes("health") || lower.includes("health score")) {
      return this.healthScoreResponse();
    }
    if (lower.includes("risk") || lower.includes("circuit breaker") || lower.includes("kill switch")) {
      return this.riskResponse();
    }
    if (lower.includes("benchmark") || lower.includes("btc") || lower.includes("eth")) {
      return this.benchmarkResponse();
    }
    if (lower.includes("diversif")) {
      return this.diversificationResponse();
    }
    if (lower.includes("allocation") || lower.includes("concentration")) {
      return this.allocationResponse();
    }
    if (lower.includes("report")) {
      return this.reportResponse(lower);
    }
    if (lower.includes("strategy") && lower.includes("explain")) {
      return this.strategyExplanationResponse();
    }

    return this.defaultResponse(userMessage);
  }

  private portfolioPerformanceResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Portfolio Performance Analysis",
      "",
      "Based on the portfolio data available in the platform, here is a summary of performance characteristics:",
      "",
      "**Return Attribution**: The portfolio's time-weighted return reflects the combined contribution of all active strategies. Strategies with higher trade frequency tend to contribute more variance to overall returns.",
      "",
      "**Risk-Adjusted Performance**: The Sharpe ratio measures return per unit of risk taken. A ratio above 1.0 indicates the portfolio is being compensated adequately for volatility. Below 0.5 suggests the return does not justify the risk profile.",
      "",
      "**Key Observations**:",
      "- TWR isolates performance from cash flows, making it the most reliable comparison metric",
      "- MWR (Modified Dietz) captures the impact of timing of capital deployment",
      "- Maximum drawdown is the most important capital preservation metric",
      "",
      "For a full quantitative breakdown, generate a Portfolio Report using the report endpoint.",
    ].join("\n");
  }

  private drawdownResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Drawdown Analysis",
      "",
      "Drawdown events occur when the portfolio equity falls below a previous peak. Understanding drawdown has three components:",
      "",
      "**1. What caused the drawdown?**",
      "Drawdowns are caused by a series of losing trades, adverse market conditions, or strategy behavior during specific market regimes (trending vs. mean-reverting markets).",
      "",
      "**2. How deep and how long?**",
      "The depth (maximum drawdown %) and the recovery time are the key dimensions. Deep, prolonged drawdowns indicate either strategy unsuitability for the current regime or excessive position sizing.",
      "",
      "**3. Risk engine response**",
      "The Phase 6 risk engine monitors drawdown in real time. If a configured threshold is breached, a circuit breaker will fire and halt further trading until conditions improve or an operator manually resumes.",
      "",
      "**Recommendation**: Review the drawdown events table in the risk dashboard and compare the drawdown onset with market data to identify the regime that triggered it.",
    ].join("\n");
  }

  private strategyComparisonResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Strategy Comparison Analysis",
      "",
      "When comparing strategies, focus on risk-adjusted metrics rather than raw returns:",
      "",
      "| Metric | What It Tells You |",
      "|--------|-------------------|",
      "| Sharpe Ratio | Return per unit of total risk |",
      "| Sortino Ratio | Return per unit of downside risk |",
      "| Calmar Ratio | CAGR relative to maximum drawdown |",
      "| Win Rate | Consistency of profitable trades |",
      "| Profit Factor | Gross wins vs. gross losses |",
      "",
      "**Caution on rankings**: A strategy with the highest Sharpe in backtest does not guarantee the best forward performance. Walk-forward validation and Monte Carlo analysis provide more robust estimates of robustness.",
      "",
      "Use the `/v1/research/compare` endpoint to generate a side-by-side comparison of backtest runs.",
    ].join("\n");
  }

  private healthScoreResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Portfolio Health Score Explanation",
      "",
      "The health score (0–100, grade A–F) is a composite metric across five dimensions:",
      "",
      "1. **Diversification** — measures how spread your capital is across assets and strategies (HHI-based)",
      "2. **Performance** — compares returns against benchmarks and risk thresholds",
      "3. **Risk** — evaluates drawdown levels, volatility, and risk profile compliance",
      "4. **Activity** — assesses whether strategies are actively generating trades",
      "5. **Drawdown** — penalizes portfolios in active drawdown relative to peak equity",
      "",
      "A low score typically indicates one or more dimensions are underperforming. Check the health breakdown endpoint for per-dimension scores to identify where to focus attention.",
      "",
      "**Note**: The health score is advisory. It does not trigger any trading actions automatically.",
    ].join("\n");
  }

  private riskResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Risk System Explanation",
      "",
      "The QuantForge risk engine operates as a pre-trade gatekeeper with 13 sequential checks:",
      "",
      "**Kill Switch** → **Circuit Breakers** → **Account Limits** → **Position Size** → **Exposure** → **Daily Loss** → **Drawdown** → **Concentration** → **Open Positions** → **Strategy Confidence** → **Data Freshness**",
      "",
      "Each check can result in: Approved, Rejected, or Requires Review.",
      "",
      "**Circuit Breakers** fire automatically on: consecutive loss streak, drawdown threshold breach, execution failures, volatility spikes, data staleness, or market closure detection.",
      "",
      "**Kill Switch** can be activated at 5 scopes: global trading halt, per-account, per-strategy, portfolio-level, or scheduler pause.",
      "",
      "**IMPORTANT**: The AI cannot override, reset, or bypass any risk control. Risk decisions are made solely by the risk engine based on configured profiles.",
    ].join("\n");
  }

  private benchmarkResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Benchmark Performance Analysis",
      "",
      "Benchmark comparison reveals how well the portfolio performs relative to a passive buy-and-hold alternative.",
      "",
      "**Key metrics for benchmark comparison**:",
      "- **Alpha**: Return above the benchmark (positive = outperforming)",
      "- **Beta**: Sensitivity to benchmark moves (1.0 = perfectly correlated)",
      "- **Information Ratio**: Alpha per unit of tracking error",
      "",
      "**Crypto benchmark context**: BTC often serves as the primary risk-on indicator in crypto markets. Outperforming BTC on a risk-adjusted basis is the benchmark target for crypto strategies.",
      "",
      "A portfolio with positive alpha but high beta is taking on additional market risk; the alpha may not be skill but leverage. Look for positive alpha with beta < 1.0 as the strongest signal of strategy value.",
    ].join("\n");
  }

  private diversificationResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Diversification Analysis",
      "",
      "Diversification is measured using the Herfindahl-Hirschman Index (HHI) — a concentration metric:",
      "",
      "- **HHI = 1.0**: Single asset (fully concentrated)",
      "- **HHI = 0.5**: Two equally-weighted assets",
      "- **HHI < 0.25**: Well-diversified across 4+ assets",
      "",
      "Low diversification increases idiosyncratic risk — the risk specific to individual assets or strategies rather than the broader market.",
      "",
      "**Why diversification matters in crypto**: Crypto assets are highly correlated during market stress. True diversification requires strategies with different regime sensitivities, not just multiple tokens.",
      "",
      "The correlation matrix (available in the risk dashboard) shows which asset pairs are most correlated. High correlation between holdings reduces the effective diversification benefit.",
    ].join("\n");
  }

  private allocationResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Allocation Analysis",
      "",
      "Portfolio allocation refers to how capital is distributed across strategies and assets at any point in time.",
      "",
      "**Concentration risk**: When a single position, asset, or strategy represents an outsized fraction of the portfolio, a single adverse event can have a disproportionate impact.",
      "",
      "**Drift detection**: The allocation tracker compares current weights against target weights. Significant drift (> configured threshold) triggers a rebalance recommendation.",
      "",
      "**Idle capital**: Capital sitting in cash earns no return but also takes no risk. High idle capital may indicate strategies are generating fewer signals than expected.",
      "",
      "**Note**: The AI explains allocation patterns but does not recommend specific rebalancing trades or position sizes.",
    ].join("\n");
  }

  private reportResponse(lower: string): string {
    const type = lower.includes("risk")
      ? "Risk"
      : lower.includes("portfolio")
      ? "Portfolio"
      : lower.includes("strategy")
      ? "Strategy"
      : lower.includes("benchmark")
      ? "Benchmark"
      : "General";

    return [
      `**[Mock AI Response — Configure a real LLM provider for live analysis]**`,
      "",
      `## ${type} Report Summary`,
      "",
      `This is a simulated ${type.toLowerCase()} report generated by the Mock AI provider.`,
      "",
      "**Executive Summary**: The platform is operating within configured risk parameters. All scheduled analytics have completed successfully. No critical issues detected.",
      "",
      "**Key Metrics** (from stored platform data):",
      "- Portfolio analytics are computed by the Phase 7 analytics engine",
      "- Risk decisions are enforced by the Phase 6 risk engine",
      "- Performance metrics are time-weighted and drawdown-adjusted",
      "",
      "**Methodology**: This report aggregates stored snapshots from the analytics scheduler. Data freshness depends on the last scheduler run (health: 1h, performance: 1d, allocation: 15m).",
      "",
      "**Advisory Notice**: This report is informational only. All capital allocation decisions remain with the human operator.",
    ].join("\n");
  }

  private strategyExplanationResponse(): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      "## Strategy Explanation",
      "",
      "**Strengths**: Strategies with high Sharpe ratios and stable walk-forward results demonstrate consistent risk-adjusted performance across different market periods.",
      "",
      "**Weaknesses**: Most systematic strategies have regime-dependent performance. Mean-reversion strategies underperform in trending markets; trend-following strategies underperform in choppy, sideways markets.",
      "",
      "**Drawdown behavior**: The drawdown profile reveals how a strategy recovers from losses. Fast recovery with shallow drawdowns indicates resilience. Deep drawdowns with slow recovery indicate strategies are sensitive to adverse runs.",
      "",
      "**Win rate vs. profit factor**: A strategy can be profitable with a win rate below 50% if the average win is significantly larger than the average loss (positive expectancy). Evaluate both together.",
      "",
      "**Market suitability**: Review performance across different market regimes using the walk-forward results. Consistent OOS (out-of-sample) performance is a stronger signal than in-sample results alone.",
    ].join("\n");
  }

  private defaultResponse(userMessage: string): string {
    return [
      "**[Mock AI Response — Configure a real LLM provider for live analysis]**",
      "",
      `I received your question: *"${userMessage}"*`,
      "",
      "The QuantForge AI Research Assistant can help you understand:",
      "",
      "- **Portfolio performance**: TWR, MWR, Sharpe, Alpha, Beta, drawdown analysis",
      "- **Strategy analysis**: strengths, weaknesses, win rate, regime suitability",
      "- **Risk events**: circuit breakers, kill switch events, violations",
      "- **Health scores**: composite score breakdowns across 5 dimensions",
      "- **Benchmark comparison**: alpha, beta, information ratio vs. BTC/ETH/SOL",
      "- **Diversification**: HHI, concentration risk, correlation analysis",
      "- **Report generation**: portfolio, strategy, risk, daily, weekly, monthly",
      "",
      "To get a live AI response, configure `AI_PROVIDER` and the appropriate API key environment variable.",
      "",
      "**Advisory Notice**: AI responses are explanatory only. The AI has no ability to execute trades, modify positions, override risk controls, or control capital.",
    ].join("\n");
  }

  private estimateTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}
