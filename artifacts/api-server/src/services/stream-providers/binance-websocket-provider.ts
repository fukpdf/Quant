import { logger } from "../../lib/logger";
import type {
  IStreamProvider,
  RawStreamEvent,
  RawTickEvent,
  RawOrderBookEvent,
  RawTradeEvent,
  StreamType,
} from "../stream-types";

/**
 * BinanceWebSocketProvider — connects to Binance combined stream endpoint.
 *
 * Uses the ws package for WebSocket connectivity. Handles:
 * - Combined stream subscription (ticker + depth + aggTrade)
 * - Ping/pong heartbeat (Binance sends ping every 3min, expects pong)
 * - Graceful disconnect
 *
 * NOTE: This provider requires the `ws` package. Install via:
 *   pnpm --filter @workspace/api-server add ws
 *   pnpm --filter @workspace/api-server add -D @types/ws
 *
 * Lazy import is used so the server starts even if ws is not installed —
 * the MockStreamProvider is the default and never needs ws.
 */

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream?streams=";

// Stream name builders
function tickerStream(symbol: string): string {
  return `${symbol.toLowerCase()}@ticker`;
}
function depthStream(symbol: string, levels = 5): string {
  return `${symbol.toLowerCase()}@depth${levels}@1000ms`;
}
function tradeStream(symbol: string): string {
  return `${symbol.toLowerCase()}@aggTrade`;
}

function buildStreamUrl(symbols: string[], streamTypes: StreamType[]): string {
  const streams: string[] = [];
  for (const sym of symbols) {
    if (streamTypes.includes("ticker")) streams.push(tickerStream(sym));
    if (streamTypes.includes("orderbook")) streams.push(depthStream(sym));
    if (streamTypes.includes("trade")) streams.push(tradeStream(sym));
  }
  return BINANCE_WS_BASE + streams.join("/");
}

export class BinanceWebSocketProvider implements IStreamProvider {
  readonly name = "binance" as const;

  private symbols: string[] = [];
  private streamTypes: StreamType[] = [];
  private sessionId = "";
  private ws: unknown = null;
  private connected = false;

  private eventHandlers: Array<(event: RawStreamEvent) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private disconnectHandlers: Array<(reason: string) => void> = [];

  async connect(symbols: string[], streamTypes: StreamType[], sessionId: string): Promise<void> {
    this.symbols = [...symbols];
    this.streamTypes = [...streamTypes];
    this.sessionId = sessionId;

    const url = buildStreamUrl(symbols, streamTypes);
    logger.info({ provider: "binance", url, symbols }, "BinanceWebSocketProvider connecting");

    // Dynamic import — ws may not be installed in all environments
    let WS: { new(url: string): { send: (d: string) => void; close: () => void; on: (e: string, h: unknown) => void } };
    try {
      const wsModule = await import("ws") as { default: typeof WS; WebSocket: typeof WS };
      WS = wsModule.default ?? wsModule.WebSocket;
    } catch {
      logger.error("ws package not installed — run: pnpm --filter @workspace/api-server add ws");
      throw new Error("ws package not available. Install with: pnpm --filter @workspace/api-server add ws");
    }

    return new Promise((resolve, reject) => {
      const ws = new WS(url);
      this.ws = ws;

      ws.on("open", () => {
        this.connected = true;
        logger.info({ provider: "binance", symbols }, "Binance WebSocket connected");
        resolve();
      });

      ws.on("message", (data: Buffer | string) => {
        try {
          const now = Date.now();
          const msg = JSON.parse(typeof data === "string" ? data : data.toString()) as Record<string, unknown>;
          const stream = msg["stream"] as string | undefined;
          const payload = msg["data"] as Record<string, unknown> | undefined;
          if (!stream || !payload) return;

          const event = this.parseMessage(stream, payload, now);
          if (event) {
            for (const h of this.eventHandlers) h(event);
          }
        } catch (err) {
          logger.warn({ err }, "BinanceWebSocketProvider: parse error");
        }
      });

      ws.on("ping", () => {
        // Binance requires pong response within 10 minutes
        (ws as unknown as { pong: () => void }).pong?.();
      });

      ws.on("error", (err: Error) => {
        logger.error({ err, provider: "binance" }, "Binance WebSocket error");
        for (const h of this.errorHandlers) h(err);
        if (!this.connected) reject(err);
      });

      ws.on("close", (code: number, reason: Buffer) => {
        this.connected = false;
        const reasonStr = reason?.toString() ?? "unknown";
        logger.info({ code, reason: reasonStr }, "Binance WebSocket closed");
        for (const h of this.disconnectHandlers) h(reasonStr);
      });
    });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) {
      (this.ws as { close: () => void }).close();
      this.ws = null;
    }
  }

  async subscribe(_symbol: string, _streamTypes: StreamType[]): Promise<void> {
    // Combined stream URL doesn't support runtime subscription changes;
    // reconnect with updated symbol list instead.
    logger.warn("BinanceWebSocketProvider: dynamic subscribe requires reconnect — call connect() with updated symbols");
  }

  async unsubscribe(_symbol: string): Promise<void> {
    logger.warn("BinanceWebSocketProvider: dynamic unsubscribe requires reconnect — call connect() with updated symbols");
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

  // ---------------------------------------------------------------------------
  // Binance message parsing
  // ---------------------------------------------------------------------------

  private parseMessage(stream: string, data: Record<string, unknown>, now: number): RawStreamEvent | null {
    if (stream.includes("@ticker")) return this.parseTicker(data, now);
    if (stream.includes("@depth")) return this.parseDepth(data, now);
    if (stream.includes("@aggTrade")) return this.parseTrade(data, now);
    return null;
  }

  private parseTicker(d: Record<string, unknown>, now: number): RawTickEvent {
    const symbol = (d["s"] as string) ?? "";
    const price = (d["c"] as string) ?? "0";
    const bid = (d["b"] as string);
    const ask = (d["a"] as string);
    return {
      type: "tick",
      symbol,
      provider: "binance",
      price,
      bidPrice: bid,
      askPrice: ask,
      spread: bid && ask ? String(Number(ask) - Number(bid)) : undefined,
      volume: (d["v"] as string),
      quoteVolume: (d["q"] as string),
      priceChangePercent: (d["P"] as string),
      exchangeTimestamp: d["T"] as number ?? now,
      receivedAt: now,
    };
  }

  private parseDepth(d: Record<string, unknown>, now: number): RawOrderBookEvent {
    const bids = (d["b"] as [string, string][]) ?? [];
    const asks = (d["a"] as [string, string][]) ?? [];
    const bestBid = bids[0]?.[0];
    const bestBidQty = bids[0]?.[1];
    const bestAsk = asks[0]?.[0];
    const bestAskQty = asks[0]?.[1];
    // symbol not in depth payload — derive from session context
    const symbol = this.symbols[0] ?? "";
    return {
      type: "orderbook",
      symbol,
      provider: "binance",
      bestBid,
      bestBidQty,
      bestAsk,
      bestAskQty,
      bids,
      asks,
      exchangeTimestamp: now,
      receivedAt: now,
    };
  }

  private parseTrade(d: Record<string, unknown>, now: number): RawTradeEvent {
    return {
      type: "trade",
      symbol: (d["s"] as string) ?? "",
      provider: "binance",
      tradeId: String(d["a"] ?? ""),
      price: (d["p"] as string) ?? "0",
      quantity: (d["q"] as string) ?? "0",
      quoteQuantity: String(Number(d["p"] ?? 0) * Number(d["q"] ?? 0)),
      isBuyerMaker: (d["m"] as boolean),
      exchangeTimestamp: (d["T"] as number) ?? now,
      receivedAt: now,
    };
  }
}
