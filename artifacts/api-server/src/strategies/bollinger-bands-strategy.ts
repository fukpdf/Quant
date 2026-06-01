import { BaseStrategy } from "./base";
import { bollingerBands } from "./indicators";
import type { StrategyContext, Signal, ParameterSchema } from "./types";

/**
 * Bollinger Bands Mean Reversion Strategy
 *
 * Logic:
 *  - BUY  when price closes below the lower band (and not in position)
 *  - SELL when price closes above the upper band (and in position)
 *  - HOLD otherwise
 *
 * Parameters:
 *  - period:      SMA period for the middle band (default 20)
 *  - stdDevMult:  Standard deviation multiplier for band width (default 2.0)
 */
export class BollingerBandsStrategy extends BaseStrategy {
  readonly name = "bollinger_bands";
  readonly displayName = "Bollinger Bands";
  readonly description =
    "Mean reversion strategy based on Bollinger Bands. Buys when price closes " +
    "below the lower band and sells when price closes above the upper band.";

  readonly parameterSchema: ParameterSchema = {
    period: {
      type: "integer",
      default: 20,
      min: 5,
      max: 200,
      description: "SMA period for the middle Bollinger Band",
    },
    stdDevMult: {
      type: "float",
      default: 2.0,
      min: 0.5,
      max: 4.0,
      description: "Standard deviation multiplier controlling band width",
    },
  };

  generateSignal(ctx: StrategyContext): Signal {
    const period = this.getParam("period");
    const stdDevMult = this.getParam("stdDevMult");

    const closes = this.closes(ctx);

    if (closes.length < period) {
      return "HOLD";
    }

    const bands = bollingerBands(closes, period, stdDevMult);
    const last = closes.length - 1;

    const currentClose = closes[last]!;
    const upperBand = bands.upper[last]!;
    const lowerBand = bands.lower[last]!;

    if (isNaN(upperBand) || isNaN(lowerBand)) return "HOLD";

    if (currentClose < lowerBand && !ctx.inPosition) return "BUY";
    if (currentClose > upperBand && ctx.inPosition) return "SELL";
    return "HOLD";
  }
}
