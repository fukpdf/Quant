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
 * Stocks & Indices data provider — PLACEHOLDER / NOT YET CONFIGURED
 *
 * Stub provider for equities and index instruments.
 * Activate by implementing against Polygon.io, Alpha Vantage, Yahoo Finance,
 * or similar and setting the required env vars.
 *
 * Required env vars (TBD based on provider choice):
 *   STOCKS_PROVIDER_API_KEY
 *   STOCKS_PROVIDER_BASE_URL (optional)
 */
export class StocksProvider implements IMarketProvider {
  readonly name = "stocks-placeholder";
  readonly displayName = "Stocks & Indices Provider (Pending)";
  readonly description =
    "Equities and indices market data provider — not yet configured. " +
    "Will support S&P 500, NASDAQ 100, individual equities, and ETFs.";
  readonly supportedTypes: MarketType[] = ["stock", "index"];
  readonly requiresAuth = true;
  readonly baseUrl = "";

  async getStatus(): Promise<ProviderStatusResult> {
    return {
      status: "inactive",
      latencyMs: null,
      message:
        "Stocks provider is not yet configured. Set STOCKS_PROVIDER_API_KEY to activate.",
      checkedAt: new Date(),
    };
  }

  async getMarkets(): Promise<ProviderMarketInfo[]> {
    return [
      { symbol: "SPY", name: "SPDR S&P 500 ETF", type: "index", exchange: "provider-pending", active: false },
      { symbol: "QQQ", name: "Invesco NASDAQ-100 ETF", type: "index", exchange: "provider-pending", active: false },
      { symbol: "AAPL", name: "Apple Inc.", type: "stock", exchange: "provider-pending", active: false },
      { symbol: "MSFT", name: "Microsoft Corporation", type: "stock", exchange: "provider-pending", active: false },
      { symbol: "TSLA", name: "Tesla Inc.", type: "stock", exchange: "provider-pending", active: false },
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

export const stocksProvider = new StocksProvider();
