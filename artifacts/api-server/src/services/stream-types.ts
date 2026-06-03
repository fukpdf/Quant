/**
 * stream-types.ts — shared TypeScript types for Phase 9 Real-Time Streaming Infrastructure.
 *
 * All streaming providers, processors, and engines reference these types.
 * No business logic here — types only.
 */

// ---------------------------------------------------------------------------
// Provider Identity
// ---------------------------------------------------------------------------

export type StreamProviderName = "binance" | "mock" | "forex" | "equities" | "crypto";

// ---------------------------------------------------------------------------
// Raw Stream Events (what providers emit)
// ---------------------------------------------------------------------------

export interface RawTickEvent {
  type: "tick";
  symbol: string;
  provider: StreamProviderName;
  price: string;
  bidPrice?: string;
  askPrice?: string;
  spread?: string;
  volume?: string;
  quoteVolume?: string;
  priceChangePercent?: string;
  exchangeTimestamp?: number;
  receivedAt: number;
}

export interface RawOrderBookEvent {
  type: "orderbook";
  symbol: string;
  provider: StreamProviderName;
  bestBid?: string;
  bestBidQty?: string;
  bestAsk?: string;
  bestAskQty?: string;
  bids: [string, string][];
  asks: [string, string][];
  exchangeTimestamp?: number;
  receivedAt: number;
}

export interface RawTradeEvent {
  type: "trade";
  symbol: string;
  provider: StreamProviderName;
  tradeId?: string;
  price: string;
  quantity: string;
  quoteQuantity?: string;
  isBuyerMaker?: boolean;
  exchangeTimestamp?: number;
  receivedAt: number;
}

export type RawStreamEvent = RawTickEvent | RawOrderBookEvent | RawTradeEvent;

// ---------------------------------------------------------------------------
// Event Bus Events (internal platform events)
// ---------------------------------------------------------------------------

export type EventBusEventType =
  | "TickReceived"
  | "OrderBookUpdated"
  | "TradeReceived"
  | "StreamConnected"
  | "StreamDisconnected"
  | "ProviderFailure"
  | "RecoveryTriggered"
  | "RecoveryComplete"
  | "MarketStateUpdated"
  | "HeartbeatReceived"
  | "GapDetected"
  | "ReplayStarted"
  | "ReplayStopped"
  | "HealthCheckCompleted"
  // Phase 10 — Execution Engine events
  | "OrderCreated"
  | "OrderValidated"
  | "OrderApproved"
  | "OrderRejected"
  | "OrderRouted"
  | "OrderAcknowledged"
  | "OrderFilled"
  | "OrderCancelled"
  | "OrderFailed"
  | "PositionUpdated"
  | "ExecutionRecovered";

export interface EventBusPayload {
  eventType: EventBusEventType;
  source: string;
  symbol?: string;
  provider?: StreamProviderName;
  sessionId?: string;
  data: Record<string, unknown>;
  emittedAt: number;
}

// ---------------------------------------------------------------------------
// Market State (in-memory per symbol)
// ---------------------------------------------------------------------------

export interface MarketState {
  symbol: string;
  provider: StreamProviderName;
  lastPrice: number | null;
  bidPrice: number | null;
  askPrice: number | null;
  spread: number | null;
  vwap: number | null;
  volume: number;
  quoteVolume: number;
  priceChangePercent: number | null;
  momentum: number | null;
  volatility: number | null;
  imbalance: number | null;
  marketStatus: "open" | "closed" | "halted" | "pre_market" | "after_hours";
  tickCount: number;
  ticksPerSecond: number;
  lastTickAt: number | null;
  sessionId: string | null;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Stream Session (in-memory runtime tracking)
// ---------------------------------------------------------------------------

export interface ActiveSession {
  id: string;
  provider: StreamProviderName;
  status: "connecting" | "active" | "reconnecting" | "closed" | "failed";
  symbols: string[];
  streamTypes: StreamType[];
  endpoint: string;
  reconnectCount: number;
  ticksReceived: number;
  eventsProcessed: number;
  bytesReceived: number;
  startedAt: number;
  lastHeartbeatAt: number | null;
}

export type StreamType = "ticker" | "orderbook" | "trade";

// ---------------------------------------------------------------------------
// Latency Tracking
// ---------------------------------------------------------------------------

export interface LatencyRecord {
  provider: StreamProviderName;
  symbol?: string;
  metricType: "provider_latency" | "processing_latency" | "storage_latency" | "queue_latency" | "end_to_end";
  valueMs: number;
  exchangeTimestampMs?: number;
  receiveTimestampMs?: number;
  processTimestampMs?: number;
  storeTimestampMs?: number;
  sessionId?: string;
}

// ---------------------------------------------------------------------------
// Replay Engine
// ---------------------------------------------------------------------------

export type ReplaySpeed = 1 | 5 | 10 | 100;

export interface ReplayConfig {
  symbol: string;
  fromTime: Date;
  toTime: Date;
  speed: ReplaySpeed;
  streamTypes: StreamType[];
}

export interface ReplayState {
  id: string;
  config: ReplayConfig;
  status: "idle" | "running" | "paused" | "completed" | "failed";
  ticksReplayed: number;
  totalTicks: number;
  currentTime: Date | null;
  startedAt: number | null;
  completedAt: number | null;
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Recovery
// ---------------------------------------------------------------------------

export interface GapInfo {
  symbol: string;
  provider: StreamProviderName;
  gapStart: Date;
  gapEnd: Date;
  estimatedMissingTicks: number;
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface ProviderHealthStatus {
  provider: StreamProviderName;
  connectionStatus: "healthy" | "degraded" | "disconnected" | "failed";
  heartbeatAgeSeconds: number | null;
  lastTickAgeSeconds: number | null;
  reconnectCount: number;
  failureCount: number;
  ticksPerSecond: number;
  avgLatencyMs: number | null;
  p99LatencyMs: number | null;
  healthScore: number;
  subscribedSymbols: number;
  sessionId: string | null;
}

// ---------------------------------------------------------------------------
// IStreamProvider Interface
// ---------------------------------------------------------------------------

export interface IStreamProvider {
  /** Provider name */
  readonly name: StreamProviderName;

  /** Connect to the streaming source */
  connect(symbols: string[], streamTypes: StreamType[], sessionId: string): Promise<void>;

  /** Disconnect gracefully */
  disconnect(): Promise<void>;

  /** Subscribe to additional symbol */
  subscribe(symbol: string, streamTypes: StreamType[]): Promise<void>;

  /** Unsubscribe from symbol */
  unsubscribe(symbol: string): Promise<void>;

  /** Is provider currently connected */
  isConnected(): boolean;

  /** Register event handler for raw stream events */
  onEvent(handler: (event: RawStreamEvent) => void): void;

  /** Register error handler */
  onError(handler: (error: Error) => void): void;

  /** Register disconnect handler */
  onDisconnect(handler: (reason: string) => void): void;

  /** Get current subscribed symbols */
  getSubscribedSymbols(): string[];
}
