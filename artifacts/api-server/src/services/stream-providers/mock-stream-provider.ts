import { logger } from "../../lib/logger";
import type {
  IStreamProvider,
  RawStreamEvent,
  RawTickEvent,
  RawOrderBookEvent,
  RawTradeEvent,
  StreamType,
} from "../stream-types";

const TICK_INTERVAL_MS = 1000;

// Realistic base prices for mock data
const BASE_PRICES: Record<string, number> = {
  BTCUSDT: 67000,
  ETHUSDT: 3500,
  SOLUSDT: 180,
  BNBUSDT: 600,
};

function randomPct(range: number): number {
  return (Math.random() - 0.5) * 2 * range;
}

function mockPrice(base: number, symbol: string): number {
  const drift = BASE_PRICES[symbol] ?? base;
  return drift * (1 + randomPct(0.001));
}

/**
 * MockStreamProvider — generates realistic synthetic tick/orderbook/trade events.
 * Used in development/testing when STREAM_PROVIDER=mock (default).
 * No network connections, no API keys required.
 */
export class MockStreamProvider implements IStreamProvider {
  readonly name = "mock" as const;

  private symbols: string[] = [];
  private streamTypes: StreamType[] = [];
  private sessionId = "";
  private connected = false;
  private tickInterval: NodeJS.Timeout | null = null;

  private eventHandlers: Array<(event: RawStreamEvent) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private disconnectHandlers: Array<(reason: string) => void> = [];

  // Track last prices for realistic movement
  private lastPrices: Map<string, number> = new Map();

  async connect(symbols: string[], streamTypes: StreamType[], sessionId: string): Promise<void> {
    this.symbols = [...symbols];
    this.streamTypes = [...streamTypes];
    this.sessionId = sessionId;
    this.connected = true;

    // Seed initial prices
    for (const sym of symbols) {
      this.lastPrices.set(sym, BASE_PRICES[sym] ?? 100);
    }

    logger.info({ provider: "mock", symbols, streamTypes }, "MockStreamProvider connected");

    // Emit ticks at configured interval
    this.tickInterval = setInterval(() => {
      this.emitTick();
    }, TICK_INTERVAL_MS);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const h of this.disconnectHandlers) h("graceful_shutdown");
    logger.info({ provider: "mock" }, "MockStreamProvider disconnected");
  }

  async subscribe(symbol: string, streamTypes: StreamType[]): Promise<void> {
    if (!this.symbols.includes(symbol)) {
      this.symbols.push(symbol);
      this.lastPrices.set(symbol, BASE_PRICES[symbol] ?? 100);
    }
    for (const st of streamTypes) {
      if (!this.streamTypes.includes(st)) this.streamTypes.push(st);
    }
  }

  async unsubscribe(symbol: string): Promise<void> {
    this.symbols = this.symbols.filter((s) => s !== symbol);
    this.lastPrices.delete(symbol);
  }

  isConnected(): boolean {
    return this.connected;
  }

  onEvent(handler: (event: RawStreamEvent) => void): void {
    this.eventHandlers.push(handler);
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  onDisconnect(handler: (reason: string) => void): void {
    this.disconnectHandlers.push(handler);
  }

  getSubscribedSymbols(): string[] {
    return [...this.symbols];
  }

  private emitTick(): void {
    for (const symbol of this.symbols) {
      const prev = this.lastPrices.get(symbol) ?? (BASE_PRICES[symbol] ?? 100);
      const price = mockPrice(prev, symbol);
      this.lastPrices.set(symbol, price);

      const spread = price * 0.0002;
      const bid = price - spread / 2;
      const ask = price + spread / 2;
      const now = Date.now();

      if (this.streamTypes.includes("ticker")) {
        const tick: RawTickEvent = {
          type: "tick",
          symbol,
          provider: "mock",
          price: price.toFixed(8),
          bidPrice: bid.toFixed(8),
          askPrice: ask.toFixed(8),
          spread: spread.toFixed(8),
          volume: (Math.random() * 10).toFixed(4),
          quoteVolume: (price * Math.random() * 10).toFixed(2),
          priceChangePercent: randomPct(2).toFixed(4),
          exchangeTimestamp: now,
          receivedAt: now,
        };
        for (const h of this.eventHandlers) h(tick);
      }

      if (this.streamTypes.includes("orderbook")) {
        const book: RawOrderBookEvent = {
          type: "orderbook",
          symbol,
          provider: "mock",
          bestBid: bid.toFixed(8),
          bestBidQty: (Math.random() * 2).toFixed(4),
          bestAsk: ask.toFixed(8),
          bestAskQty: (Math.random() * 2).toFixed(4),
          bids: Array.from({ length: 5 }, (_, i) => [
            (bid - i * spread).toFixed(8),
            (Math.random() * 3).toFixed(4),
          ] as [string, string]),
          asks: Array.from({ length: 5 }, (_, i) => [
            (ask + i * spread).toFixed(8),
            (Math.random() * 3).toFixed(4),
          ] as [string, string]),
          exchangeTimestamp: now,
          receivedAt: now,
        };
        for (const h of this.eventHandlers) h(book);
      }

      if (this.streamTypes.includes("trade")) {
        const qty = (Math.random() * 0.5).toFixed(6);
        const trade: RawTradeEvent = {
          type: "trade",
          symbol,
          provider: "mock",
          tradeId: String(Math.floor(Math.random() * 1e9)),
          price: price.toFixed(8),
          quantity: qty,
          quoteQuantity: (price * Number(qty)).toFixed(2),
          isBuyerMaker: Math.random() > 0.5,
          exchangeTimestamp: now,
          receivedAt: now,
        };
        for (const h of this.eventHandlers) h(trade);
      }
    }
  }
}
