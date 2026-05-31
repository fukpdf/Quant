import type { IMarketProvider, MarketType } from "./types";
import { binanceProvider } from "./binance.provider";
import { forexProvider } from "./forex.provider";
import { stocksProvider } from "./stocks.provider";
import { commoditiesProvider } from "./commodities.provider";
import { logger } from "../lib/logger";

/**
 * ProviderRegistry — central catalog of all registered data providers.
 *
 * Architectural principle: business logic never instantiates providers
 * directly. It asks the registry for a provider by name or market type.
 * This decouples business logic from provider implementations and makes
 * adding new providers a pure registration step.
 *
 * Usage:
 *   providerRegistry.get("binance")              // by name
 *   providerRegistry.getForType("crypto")        // by market type
 *   providerRegistry.list()                      // all providers
 *   providerRegistry.listActive()                // only status=active in DB
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, IMarketProvider>();

  register(provider: IMarketProvider): void {
    if (this.providers.has(provider.name)) {
      logger.warn(
        { provider: provider.name },
        "ProviderRegistry: overwriting existing provider registration",
      );
    }
    this.providers.set(provider.name, provider);
    logger.debug(
      { provider: provider.name, types: provider.supportedTypes },
      "Provider registered",
    );
  }

  get(name: string): IMarketProvider | null {
    return this.providers.get(name) ?? null;
  }

  list(): IMarketProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Return the first provider that supports the given market type.
   * When multiple providers support the same type in future, add priority logic here.
   */
  getForType(type: MarketType): IMarketProvider | null {
    for (const provider of this.providers.values()) {
      if (provider.supportedTypes.includes(type)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Return all providers that support a given market type.
   */
  getAllForType(type: MarketType): IMarketProvider[] {
    return Array.from(this.providers.values()).filter((p) =>
      p.supportedTypes.includes(type),
    );
  }

  has(name: string): boolean {
    return this.providers.has(name);
  }
}

/**
 * Singleton registry instance — the one source of truth for providers.
 * All four providers are pre-registered; inactive/stub providers
 * expose their "not configured" status via getStatus().
 */
export const providerRegistry = new ProviderRegistry();

providerRegistry.register(binanceProvider);
providerRegistry.register(forexProvider);
providerRegistry.register(stocksProvider);
providerRegistry.register(commoditiesProvider);
