import { BaseStrategy } from "./base";
import { ema } from "./indicators";
import type { StrategyContext, Signal, ParameterSchema } from "./types";

/**
 * EMA Crossover Strategy
 *
 * Logic:
 *  - BUY  when fast EMA crosses above slow EMA (and not already in position)
 *  - SELL when fast EMA crosses below slow EMA (and in position)
 *  - HOLD otherwise
 *
 * Parameters:
 *  - fastPeriod: period for the fast EMA (default 9)
 *  - slowPeriod: period for the slow EMA (default 21)
 */
export class EmaCrossoverStrategy extends BaseStrategy {
  readonly name = "ema_crossover";
  readonly displayName = "EMA Crossover";
  readonly description =
    "Generates a BUY signal when the fast EMA crosses above the slow EMA, " +
    "and a SELL signal when it crosses below. Classic trend-following approach.";

  readonly parameterSchema: ParameterSchema = {
    fastPeriod: {
      type: "integer",
      default: 9,
      min: 2,
      max: 50,
      description: "Period for the fast exponential moving average",
    },
    slowPeriod: {
      type: "integer",
      default: 21,
      min: 5,
      max: 200,
      description: "Period for the slow exponential moving average",
    },
  };

  generateSignal(ctx: StrategyContext): Signal {
    const fastPeriod = this.getParam("fastPeriod");
    const slowPeriod = this.getParam("slowPeriod");

    const closes = this.closes(ctx);

    if (closes.length < slowPeriod + 1) {
      return "HOLD";
    }

    const fastEma = ema(closes, fastPeriod);
    const slowEma = ema(closes, slowPeriod);

    const last = closes.length - 1;
    const prev = last - 1;

    const fastNow = fastEma[last]!;
    const slowNow = slowEma[last]!;
    const fastPrev = fastEma[prev]!;
    const slowPrev = slowEma[prev]!;

    if (isNaN(fastNow) || isNaN(slowNow) || isNaN(fastPrev) || isNaN(slowPrev)) {
      return "HOLD";
    }

    const crossedAbove = fastPrev <= slowPrev && fastNow > slowNow;
    const crossedBelow = fastPrev >= slowPrev && fastNow < slowNow;

    if (crossedAbove && !ctx.inPosition) return "BUY";
    if (crossedBelow && ctx.inPosition) return "SELL";
    return "HOLD";
  }
}
