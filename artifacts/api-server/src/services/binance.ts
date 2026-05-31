import { logger } from "../lib/logger";

const BINANCE_BASE_URL = "https://api.binance.com/api/v3";

export type BinanceKline = [
  number,   // 0 - open time (ms)
  string,   // 1 - open
  string,   // 2 - high
  string,   // 3 - low
  string,   // 4 - close
  string,   // 5 - volume
  number,   // 6 - close time (ms)
  string,   // 7 - quote asset volume
  number,   // 8 - number of trades
  string,   // 9 - taker buy base asset volume
  string,   // 10 - taker buy quote asset volume
  string,   // 11 - ignore
];

export type BinanceTicker = {
  symbol: string;
  price: string;
};

export type BinanceKlineParams = {
  symbol: string;
  interval: string;
  limit?: number;
  startTime?: number;
  endTime?: number;
};

const VALID_INTERVALS = new Set([
  "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "8h", "12h",
  "1d", "3d", "1w", "1M",
]);

export class BinanceClient {
  private readonly baseUrl: string;

  constructor(baseUrl = BINANCE_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async fetchKlines(params: BinanceKlineParams): Promise<BinanceKline[]> {
    if (!VALID_INTERVALS.has(params.interval)) {
      throw new Error(`Invalid Binance interval: ${params.interval}`);
    }

    const query = new URLSearchParams({
      symbol: params.symbol.toUpperCase(),
      interval: params.interval,
      limit: String(params.limit ?? 200),
    });

    if (params.startTime !== undefined) {
      query.set("startTime", String(params.startTime));
    }
    if (params.endTime !== undefined) {
      query.set("endTime", String(params.endTime));
    }

    const url = `${this.baseUrl}/klines?${query.toString()}`;

    logger.debug({ url, symbol: params.symbol, interval: params.interval }, "Fetching Binance klines");

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { "User-Agent": "QuantForge/1.0" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Binance API error ${response.status} for ${params.symbol}: ${body}`,
      );
    }

    const data = await response.json() as BinanceKline[];

    if (!Array.isArray(data)) {
      throw new Error(`Unexpected Binance response shape for ${params.symbol}`);
    }

    return data;
  }

  async fetchTicker(symbol: string): Promise<BinanceTicker> {
    const url = `${this.baseUrl}/ticker/price?symbol=${symbol.toUpperCase()}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "QuantForge/1.0" },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Binance ticker error ${response.status} for ${symbol}: ${body}`,
      );
    }

    return await response.json() as BinanceTicker;
  }

  async ping(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/ping`, {
        signal: AbortSignal.timeout(5_000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const binanceClient = new BinanceClient();
