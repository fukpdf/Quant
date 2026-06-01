import type { IStrategy, StrategyContext, StrategyParams, ParameterSchema, Signal } from "./types";

/**
 * Abstract base class for all QuantForge research strategies.
 * Provides default no-op lifecycle hooks and parameter resolution.
 * Subclasses must implement generateSignal().
 */
export abstract class BaseStrategy implements IStrategy {
  abstract readonly name: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly parameterSchema: ParameterSchema;

  protected params: StrategyParams = {};

  initialize(params: StrategyParams): void {
    // Merge provided params with schema defaults
    const resolved: StrategyParams = {};
    for (const [key, def] of Object.entries(this.parameterSchema)) {
      resolved[key] = key in params ? params[key]! : def.default;
    }
    this.params = resolved;
  }

  onStart(): void {
    // Default: no-op
  }

  abstract generateSignal(ctx: StrategyContext): Signal;

  onFinish(): void {
    // Default: no-op
  }

  // ---------------------------------------------------------------------------
  // Helpers for subclasses
  // ---------------------------------------------------------------------------

  protected getParam(key: string): number {
    const val = this.params[key];
    if (val === undefined) {
      throw new Error(`Strategy "${this.name}": unknown parameter "${key}"`);
    }
    return val as number;
  }

  protected getBoolParam(key: string): boolean {
    return Boolean(this.params[key]);
  }

  /** Extract closing prices from candle history up to and including the current candle */
  protected closes(ctx: StrategyContext): number[] {
    return ctx.candles.slice(0, ctx.currentIndex + 1).map((c) => c.close);
  }
}
