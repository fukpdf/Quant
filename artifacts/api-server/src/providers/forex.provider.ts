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
 * Forex data provider — PLACEHOLDER / NOT YET CONFIGURED
 *
 * This stub satisfies the IMarketProvider interface and returns structured
 * "not configured" responses. It exists so the provider registry and
 * health monitoring infrastructure work for all asset classes from day one.
 *
 * To activate: implement the methods below using your chosen forex provider
 * (OANDA, Alpha Vantage, TwelveData, etc.) and set the required env vars.
 *
 * Required env vars (TBD based on provider choice):
 *   FOREX_PROVIDER_API_KEY
 *   FOREX_PROVIDER_BASE_URL (optional — use provider's default)
 */
export class ForexProvider implements IMarketProvider {
  readonly name = "forex-placeholder";
  readonly displayName = "Forex Provider (Pending)";
  readonly description =
    "Forex market data provider — not yet configured. " +
    "Supports EUR/USD, GBP/USD, USD/JPY, and other major pairs.";
  readonly supportedTypes: MarketType[] = ["forex"];
  readonly requiresAuth = true;
  readonly baseUrl = "";

  async getStatus(): Promise<ProviderStatusResult> {
    return {
      status: "inactive",
      latencyMs: null,
      message: "Forex provider is not yet configured. Set FOREX_PROVIDER_API_KEY to activate.",
      checkedAt: new Date(),
    };
  }

  async getMarkets(): Promise<ProviderMarketInfo[]> {
    // Return the known forex pairs that will be served once configured
    return [
      { symbol: "EURUSD", name: "Euro / US Dollar", type: "forex", exchange: "provider-pending", active: false },
      { symbol: "GBPUSD", name: "British Pound / US Dollar", type: "forex", exchange: "provider-pending", active: false },
      { symbol: "USDJPY", name: "US Dollar / Japanese Yen", type: "forex", exchange: "provider-pending", active: false },
      { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", type: "forex", exchange: "provider-pending", active: false },
      { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", type: "forex", exchange: "provider-pending", active: false },
      { symbol: "USDCHF", name: "US Dollar / Swiss Franc", type: "forex", exchange: "provider-pending", active: false },
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

export const forexProvider = new ForexProvider();
