import type {
  IMarketProvider,
  MarketType,
  ProviderStatusResult,
  ProviderMarketInfo,
  ProviderPriceResult,
  ProviderCandleResult,
  CandleQueryParams,
} from "./types";

/**
 * Commodities data provider — PLACEHOLDER / NOT YET CONFIGURED
 *
 * Stub provider for commodity markets (metals, energy, agriculture).
 * Activate by implementing against a commodities data API (Quandl/Nasdaq Data Link,
 * CMC Markets, Twelve Data, etc.) and setting the required env vars.
 *
 * Required env vars (TBD based on provider choice):
 *   COMMODITIES_PROVIDER_API_KEY
 *   COMMODITIES_PROVIDER_BASE_URL (optional)
 */
export class CommoditiesProvider implements IMarketProvider {
  readonly name = "commodities-placeholder";
  readonly displayName = "Commodities Provider (Pending)";
  readonly description =
    "Commodities market data provider — not yet configured. " +
    "Will support gold, silver, crude oil, natural gas, and agricultural commodities.";
  readonly supportedTypes: MarketType[] = ["commodity"];
  readonly requiresAuth = true;
  readonly baseUrl = "";

  async getStatus(): Promise<ProviderStatusResult> {
    return {
      status: "inactive",
      latencyMs: null,
      message:
        "Commodities provider is not yet configured. Set COMMODITIES_PROVIDER_API_KEY to activate.",
      checkedAt: new Date(),
    };
  }

  async getMarkets(): Promise<ProviderMarketInfo[]> {
    return [
      { symbol: "XAUUSD", name: "Gold / US Dollar", type: "commodity", exchange: "provider-pending", active: false },
      { symbol: "XAGUSD", name: "Silver / US Dollar", type: "commodity", exchange: "provider-pending", active: false },
      { symbol: "CRUDE_OIL_WTI", name: "Crude Oil WTI", type: "commodity", exchange: "provider-pending", active: false },
      { symbol: "CRUDE_OIL_BRENT", name: "Crude Oil Brent", type: "commodity", exchange: "provider-pending", active: false },
      { symbol: "NATURAL_GAS", name: "Natural Gas", type: "commodity", exchange: "provider-pending", active: false },
    ];
  }

  async getLatestPrice(_symbol: string): Promise<ProviderPriceResult | null> {
    return null;
  }

  async getCandles(
    _symbol: string,
    _interval: string,
    _params?: CandleQueryParams,
  ): Promise<ProviderCandleResult[]> {
    return [];
  }
}

export const commoditiesProvider = new CommoditiesProvider();
