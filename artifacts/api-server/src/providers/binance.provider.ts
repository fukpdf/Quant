import { binanceClient } from "../services/binance";
import { normalizeBinanceKlines } from "../services/normalizer";
import type {
  IMarketProvider,
  MarketType,
  ProviderStatusResult,
  ProviderMarketInfo,
  ProviderPriceResult,
  ProviderCandleResult,
  CandleQueryParams,
} from "./types";
import { logger } from "../lib/logger";

/**
 * Binance public REST API provider.
 * Serves crypto/spot market data with no API key required.
 * Rate limit: 1200 requests/minute (weight-based).
 */
export class BinanceProvider implements IMarketProvider {
  readonly name = "binance";
  readonly displayName = "Binance";
  readonly description =
    "Binance public REST API for crypto spot market data. No authentication required.";
  readonly supportedTypes: MarketType[] = ["crypto"];
  readonly requiresAuth = false;
  readonly baseUrl = "https://api.binance.com";

  /** Active crypto markets served by this provider */
  private static readonly ACTIVE_MARKETS: ProviderMarketInfo[] = [
    { symbol: "BTCUSDT", name: "Bitcoin / Tether USD", type: "crypto", exchange: "binance", active: true },
    { symbol: "ETHUSDT", name: "Ethereum / Tether USD", type: "crypto", exchange: "binance", active: true },
    { symbol: "SOLUSDT", name: "Solana / Tether USD", type: "crypto", exchange: "binance", active: true },
    { symbol: "BNBUSDT", name: "BNB / Tether USD", type: "crypto", exchange: "binance", active: true },
    { symbol: "XRPUSDT", name: "XRP / Tether USD", type: "crypto", exchange: "binance", active: true },
    { symbol: "ADAUSDT", name: "Cardano / Tether USD", type: "crypto", exchange: "binance", active: true },
    { symbol: "DOGEUSDT", name: "Dogecoin / Tether USD", type: "crypto", exchange: "binance", active: true },
  ];

  async getStatus(): Promise<ProviderStatusResult> {
    const start = Date.now();
    try {
      const ok = await binanceClient.ping();
      const latencyMs = Date.now() - start;
      return {
        status: ok ? "active" : "error",
        latencyMs,
        message: ok ? "Binance API is reachable" : "Binance ping returned non-OK",
        checkedAt: new Date(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err: message }, "BinanceProvider.getStatus failed");
      return {
        status: "error",
        latencyMs: Date.now() - start,
        message,
        checkedAt: new Date(),
      };
    }
  }

  async getMarkets(): Promise<ProviderMarketInfo[]> {
    return BinanceProvider.ACTIVE_MARKETS;
  }

  async getLatestPrice(symbol: string): Promise<ProviderPriceResult | null> {
    try {
      const ticker = await binanceClient.fetchTicker(symbol);
      return {
        symbol: ticker.symbol,
        price: ticker.price,
        timestamp: new Date(),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ symbol, err: message }, "BinanceProvider.getLatestPrice failed");
      return null;
    }
  }

  async getCandles(
    symbol: string,
    interval: string,
    params?: CandleQueryParams,
  ): Promise<ProviderCandleResult[]> {
    try {
      const klines = await binanceClient.fetchKlines({
        symbol,
        interval,
        limit: params?.limit ?? 200,
        startTime: params?.startTime,
        endTime: params?.endTime,
      });
      return normalizeBinanceKlines(klines, symbol, interval).map((c) => ({
        symbol: c.symbol as string,
        timestamp: c.timestamp as Date,
        open: c.open as string,
        high: c.high as string,
        low: c.low as string,
        close: c.close as string,
        volume: c.volume as string,
        interval: c.interval as string,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn({ symbol, interval, err: message }, "BinanceProvider.getCandles failed");
      return [];
    }
  }
}

export const binanceProvider = new BinanceProvider();
