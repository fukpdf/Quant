import { BaseStrategy } from "./base";
import { rsi } from "./indicators";
import type { StrategyContext, Signal, ParameterSchema } from "./types";

/**
 * RSI Mean Reversion Strategy
 *
 * Logic:
 *  - BUY  when RSI falls below oversoldThreshold (and not in position)
 *  - SELL when RSI rises above overboughtThreshold (and in position)
 *  - HOLD otherwise
 *
 * Parameters:
 *  - period:              RSI lookback period (default 14)
 *  - oversoldThreshold:   RSI level below which market is considered oversold (default 30)
 *  - overboughtThreshold: RSI level above which market is considered overbought (default 70)
 */
export class RsiMeanReversionStrategy extends BaseStrategy {
  readonly name = "rsi_mean_reversion";
  readonly displayName = "RSI Mean Reversion";
  readonly description =
    "Buys when RSI drops below the oversold threshold and sells when RSI rises " +
    "above the overbought threshold. Counter-trend mean-reversion approach.";

  readonly parameterSchema: ParameterSchema = {
    period: {
      type: "integer",
      default: 14,
      min: 2,
      max: 100,
      description: "RSI lookback period",
    },
    oversoldThreshold: {
      type: "float",
      default: 30,
      min: 5,
      max: 49,
      description: "RSI value below which the asset is considered oversold (BUY zone)",
    },
    overboughtThreshold: {
      type: "float",
      default: 70,
      min: 51,
      max: 95,
      description: "RSI value above which the asset is considered overbought (SELL zone)",
    },
  };

  generateSignal(ctx: StrategyContext): Signal {
    const period = this.getParam("period");
    const oversold = this.getParam("oversoldThreshold");
    const overbought = this.getParam("overboughtThreshold");

    const closes = this.closes(ctx);

    if (closes.length < period + 1) {
      return "HOLD";
    }

    const rsiValues = rsi(closes, period);
    const currentRsi = rsiValues[rsiValues.length - 1];

    if (currentRsi === undefined || isNaN(currentRsi)) return "HOLD";

    if (currentRsi < oversold && !ctx.inPosition) return "BUY";
    if (currentRsi > overbought && ctx.inPosition) return "SELL";
    return "HOLD";
  }
}
