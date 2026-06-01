import type { IStrategy, StrategyParams } from "./types";
import { EmaCrossoverStrategy } from "./ema-crossover";
import { RsiMeanReversionStrategy } from "./rsi-mean-reversion";
import { MacdTrendStrategy } from "./macd-trend";
import { BollingerBandsStrategy } from "./bollinger-bands-strategy";

/**
 * Strategy registry.
 * All strategies available for backtesting are registered here.
 * To add a new strategy: implement IStrategy, then add it to STRATEGY_REGISTRY.
 */

const STRATEGY_REGISTRY: Record<string, () => IStrategy> = {
  ema_crossover: () => new EmaCrossoverStrategy(),
  rsi_mean_reversion: () => new RsiMeanReversionStrategy(),
  macd_trend: () => new MacdTrendStrategy(),
  bollinger_bands: () => new BollingerBandsStrategy(),
};

/**
 * Returns a fresh strategy instance by name.
 * Each backtest run gets its own instance — never share instances across runs.
 */
export function createStrategy(name: string): IStrategy {
  const factory = STRATEGY_REGISTRY[name];
  if (!factory) {
    throw new Error(`Unknown strategy: "${name}". Available: ${listStrategyNames().join(", ")}`);
  }
  return factory();
}

/** Returns all registered strategy instances (one per type, for metadata access) */
export function getAllStrategies(): IStrategy[] {
  return Object.values(STRATEGY_REGISTRY).map((factory) => factory());
}

export function listStrategyNames(): string[] {
  return Object.keys(STRATEGY_REGISTRY);
}

/** Resolves params against a strategy's schema defaults, then validates types */
export function resolveParams(strategy: IStrategy, params: Partial<StrategyParams>): StrategyParams {
  const resolved: StrategyParams = {};
  for (const [key, def] of Object.entries(strategy.parameterSchema)) {
    const supplied = params[key];
    if (supplied !== undefined) {
      resolved[key] = def.type === "boolean" ? Boolean(supplied) : Number(supplied);
    } else {
      resolved[key] = def.default;
    }
  }
  return resolved;
}
