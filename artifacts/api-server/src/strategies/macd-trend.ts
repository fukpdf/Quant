import { BaseStrategy } from "./base";
import { macd } from "./indicators";
import type { StrategyContext, Signal, ParameterSchema } from "./types";

/**
 * MACD Trend Following Strategy
 *
 * Logic:
 *  - BUY  when MACD line crosses above signal line (and not in position)
 *  - SELL when MACD line crosses below signal line (and in position)
 *  - HOLD otherwise
 *
 * Parameters:
 *  - fastPeriod:   Fast EMA period (default 12)
 *  - slowPeriod:   Slow EMA period (default 26)
 *  - signalPeriod: Signal line EMA period (default 9)
 */
export class MacdTrendStrategy extends BaseStrategy {
  readonly name = "macd_trend";
  readonly displayName = "MACD Trend Following";
  readonly description =
    "Follows the trend using MACD crossovers. Enters long when the MACD line " +
    "crosses above the signal line and exits when it crosses below.";

  readonly parameterSchema: ParameterSchema = {
    fastPeriod: {
      type: "integer",
      default: 12,
      min: 2,
      max: 50,
      description: "Fast EMA period for MACD calculation",
    },
    slowPeriod: {
      type: "integer",
      default: 26,
      min: 5,
      max: 200,
      description: "Slow EMA period for MACD calculation",
    },
    signalPeriod: {
      type: "integer",
      default: 9,
      min: 2,
      max: 50,
      description: "Signal line EMA period",
    },
  };

  generateSignal(ctx: StrategyContext): Signal {
    const fastPeriod = this.getParam("fastPeriod");
    const slowPeriod = this.getParam("slowPeriod");
    const signalPeriod = this.getParam("signalPeriod");

    const closes = this.closes(ctx);

    // Need enough data for the slowest component
    const minCandles = slowPeriod + signalPeriod;
    if (closes.length < minCandles + 1) {
      return "HOLD";
    }

    const { macdLine, signalLine } = macd(closes, fastPeriod, slowPeriod, signalPeriod);

    const last = closes.length - 1;
    const prev = last - 1;

    const macdNow = macdLine[last]!;
    const macdPrev = macdLine[prev]!;
    const sigNow = signalLine[last]!;
    const sigPrev = signalLine[prev]!;

    if (isNaN(macdNow) || isNaN(sigNow) || isNaN(macdPrev) || isNaN(sigPrev)) {
      return "HOLD";
    }

    const crossedAbove = macdPrev <= sigPrev && macdNow > sigNow;
    const crossedBelow = macdPrev >= sigPrev && macdNow < sigNow;

    if (crossedAbove && !ctx.inPosition) return "BUY";
    if (crossedBelow && ctx.inPosition) return "SELL";
    return "HOLD";
  }
}
