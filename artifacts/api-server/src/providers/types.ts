/**
 * Provider Abstraction Layer — Core Types
 *
 * Every data provider must implement IMarketProvider.
 * This interface is the contract between the platform's business logic
 * and the external data world. Adding a new provider never requires
 * changes to business logic — only a new implementation of this interface
 * registered in the ProviderRegistry.
 */

export type MarketType = "crypto" | "forex" | "stock" | "index" | "commodity";

export type ProviderStatusCode =
  | "active"      // fully operational
  | "inactive"    // deliberately not configured (placeholder)
  | "degraded"    // operational but with errors or elevated latency
  | "error"       // last health check failed
  | "unknown";    // never been checked

export interface ProviderStatusResult {
  status: ProviderStatusCode;
  latencyMs: number | null;
  message: string;
  checkedAt: Date;
}

export interface ProviderMarketInfo {
  symbol: string;
  name: string;
  type: MarketType;
  exchange: string;
  active: boolean;
}

export interface ProviderPriceResult {
  symbol: string;
  price: string;
  timestamp: Date;
}

export interface ProviderCandleResult {
  symbol: string;
  timestamp: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  interval: string;
}

export interface CandleQueryParams {
  limit?: number;
  startTime?: number;
  endTime?: number;
}

/**
 * The core provider interface every data source must implement.
 *
 * Design principles:
 * - All methods are async (network I/O always possible)
 * - Providers that do not support a capability return null / empty array
 *   rather than throwing (let callers decide how to handle absence)
 * - Credentials/config come from environment variables, not this interface
 */
export interface IMarketProvider {
  /** Stable machine identifier (e.g. "binance", "oanda", "alpaca") */
  readonly name: string;
  /** Human-readable display name */
  readonly displayName: string;
  /** Description of what this provider offers */
  readonly description: string;
  /** Market types this provider can serve */
  readonly supportedTypes: MarketType[];
  /** Whether the provider requires API key authentication */
  readonly requiresAuth: boolean;
  /** Provider's public API base URL */
  readonly baseUrl: string;

  /**
   * Check whether the provider is reachable and operational.
   * Should perform a lightweight ping/status request.
   * Must not throw — return an error status instead.
   */
  getStatus(): Promise<ProviderStatusResult>;

  /**
   * Return the list of markets this provider can serve.
   * May be hardcoded for simple providers or fetched from API.
   */
  getMarkets(): Promise<ProviderMarketInfo[]>;

  /**
   * Return the current price for a symbol.
   * Returns null if the symbol is not supported or data unavailable.
   */
  getLatestPrice(symbol: string): Promise<ProviderPriceResult | null>;

  /**
   * Return OHLCV candles for a symbol+interval.
   * Returns empty array if unsupported or unavailable.
   */
  getCandles(
    symbol: string,
    interval: string,
    params?: CandleQueryParams,
  ): Promise<ProviderCandleResult[]>;
}

/**
 * Returned by stub/placeholder providers that aren't yet configured.
 */
export class NotConfiguredError extends Error {
  constructor(providerName: string) {
    super(
      `Provider "${providerName}" is not yet configured. ` +
        `Set the required environment variables to enable it.`,
    );
    this.name = "NotConfiguredError";
  }
}
