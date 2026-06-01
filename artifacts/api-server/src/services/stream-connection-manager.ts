import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import {
  insertStreamSession,
  updateStreamSession,
  insertStreamFailure,
  insertStreamHealth,
} from "./stream-db";
import { publish, auditStreamAction } from "./event-bus";
import { processTickEvent, processOrderBookEvent, initMarketStateEngine, stopMarketStateEngine } from "./market-state-engine";
import { processTick } from "./tick-processor";
import { processOrderBook } from "./orderbook-processor";
import { processTradeEvent } from "./trade-processor";
import { recordLatency } from "./stream-metrics-processor";
import type {
  IStreamProvider,
  ActiveSession,
  StreamType,
  StreamProviderName,
  RawStreamEvent,
} from "./stream-types";

const HEALTH_INTERVAL_MS = 10_000;       // health check every 10 seconds
const RECONNECT_BASE_DELAY_MS = 1_000;   // initial reconnect delay
const RECONNECT_MAX_DELAY_MS = 60_000;   // max reconnect backoff
const RECONNECT_MAX_ATTEMPTS = 10;

let activeSession: ActiveSession | null = null;
let provider: IStreamProvider | null = null;
let healthTimer: NodeJS.Timeout | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
let totalFailures = 0;

const DEFAULT_SYMBOLS = (process.env["STREAM_SYMBOLS"] ?? "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT").split(",");
const DEFAULT_STREAM_TYPES: StreamType[] = ["ticker", "orderbook", "trade"];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function startStreamManager(
  streamProvider: IStreamProvider,
  symbols: string[] = DEFAULT_SYMBOLS,
  streamTypes: StreamType[] = DEFAULT_STREAM_TYPES,
): Promise<void> {
  provider = streamProvider;
  await connect(symbols, streamTypes);
}

export async function stopStreamManager(): Promise<void> {
  clearTimers();
  stopMarketStateEngine();

  if (provider && provider.isConnected()) {
    await provider.disconnect();
  }

  if (activeSession) {
    await updateStreamSession(activeSession.id, {
      status: "closed",
      isGraceful: true,
      endedAt: new Date(),
      ticksReceived: String(activeSession.ticksReceived),
      eventsProcessed: String(activeSession.eventsProcessed),
    });
    auditStreamAction("stream_stop", { sessionId: activeSession.id }, activeSession.provider, activeSession.id);
  }

  activeSession = null;
  provider = null;
  logger.info("Stream manager stopped");
}

export function getActiveSession(): ActiveSession | null {
  return activeSession;
}

export function isStreaming(): boolean {
  return activeSession !== null && activeSession.status === "active";
}

export function getStreamStatus(): {
  streaming: boolean;
  provider: StreamProviderName | null;
  session: ActiveSession | null;
  reconnectAttempts: number;
  totalFailures: number;
} {
  return {
    streaming: isStreaming(),
    provider: activeSession?.provider ?? null,
    session: activeSession,
    reconnectAttempts,
    totalFailures,
  };
}

// ---------------------------------------------------------------------------
// Internal: Connect
// ---------------------------------------------------------------------------

async function connect(symbols: string[], streamTypes: StreamType[]): Promise<void> {
  if (!provider) return;

  const sessionId = randomUUID();

  // Persist session to DB
  const dbSession = await insertStreamSession({
    provider: provider.name,
    status: "connecting",
    symbols,
    streamTypes,
    reconnectCount: String(reconnectAttempts),
  });

  activeSession = {
    id: dbSession.id,
    provider: provider.name,
    status: "connecting",
    symbols,
    streamTypes,
    endpoint: "",
    reconnectCount: reconnectAttempts,
    ticksReceived: 0,
    eventsProcessed: 0,
    bytesReceived: 0,
    startedAt: Date.now(),
    lastHeartbeatAt: null,
  };

  initMarketStateEngine(sessionId, provider.name, symbols);

  // Register event handlers on the provider
  provider.onEvent(handleRawEvent);
  provider.onError(handleProviderError);
  provider.onDisconnect(handleDisconnect);

  try {
    await provider.connect(symbols, streamTypes, dbSession.id);

    activeSession.status = "active";
    activeSession.lastHeartbeatAt = Date.now();
    reconnectAttempts = 0;

    await updateStreamSession(dbSession.id, { status: "active" });

    publish({
      eventType: "StreamConnected",
      source: "stream-connection-manager",
      provider: provider.name,
      sessionId: dbSession.id,
      data: { symbols, streamTypes, reconnectAttempts },
      emittedAt: Date.now(),
    });

    auditStreamAction("stream_start", { symbols, streamTypes }, provider.name, dbSession.id);
    startHealthLoop();

    logger.info({ provider: provider.name, symbols, sessionId: dbSession.id }, "Stream connected");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, provider: provider.name }, "Stream connection failed");

    activeSession.status = "failed";
    await updateStreamSession(dbSession.id, { status: "failed", errorMessage: msg });

    await insertStreamFailure({
      provider: provider.name,
      sessionId: dbSession.id,
      failureType: "connection_error",
      message: msg,
      affectedSymbols: symbols,
    });

    totalFailures++;
    scheduleReconnect(symbols, streamTypes);
  }
}

// ---------------------------------------------------------------------------
// Internal: Event Handling
// ---------------------------------------------------------------------------

function handleRawEvent(event: RawStreamEvent): void {
  if (!activeSession) return;
  const now = Date.now();
  activeSession.ticksReceived++;
  activeSession.eventsProcessed++;
  activeSession.lastHeartbeatAt = now;

  // Record end-to-end latency
  if (event.exchangeTimestamp) {
    recordLatency({
      provider: event.provider,
      symbol: event.symbol,
      metricType: "end_to_end",
      valueMs: now - event.exchangeTimestamp,
      exchangeTimestampMs: event.exchangeTimestamp,
      receiveTimestampMs: event.receivedAt,
      processTimestampMs: now,
      sessionId: activeSession.id,
    });
  }

  // Route to specialized processors
  switch (event.type) {
    case "tick":
      processTickEvent(event);
      void processTick(event, activeSession.id);
      publish({
        eventType: "TickReceived",
        source: "stream-connection-manager",
        symbol: event.symbol,
        provider: event.provider,
        sessionId: activeSession.id,
        data: { price: event.price, volume: event.volume },
        emittedAt: now,
      });
      break;

    case "orderbook":
      processOrderBookEvent(event);
      void processOrderBook(event, activeSession.id);
      publish({
        eventType: "OrderBookUpdated",
        source: "stream-connection-manager",
        symbol: event.symbol,
        provider: event.provider,
        sessionId: activeSession.id,
        data: { bestBid: event.bestBid, bestAsk: event.bestAsk },
        emittedAt: now,
      });
      break;

    case "trade":
      void processTradeEvent(event, activeSession.id);
      publish({
        eventType: "TradeReceived",
        source: "stream-connection-manager",
        symbol: event.symbol,
        provider: event.provider,
        sessionId: activeSession.id,
        data: { price: event.price, quantity: event.quantity },
        emittedAt: now,
      });
      break;
  }
}

function handleProviderError(err: Error): void {
  logger.error({ err, provider: activeSession?.provider }, "Stream provider error");
  totalFailures++;

  void insertStreamFailure({
    provider: activeSession?.provider ?? "unknown",
    sessionId: activeSession?.id,
    failureType: "connection_error",
    message: err.message,
    affectedSymbols: activeSession?.symbols ?? [],
  });

  publish({
    eventType: "ProviderFailure",
    source: "stream-connection-manager",
    provider: activeSession?.provider,
    sessionId: activeSession?.id,
    data: { error: err.message },
    emittedAt: Date.now(),
  });
}

function handleDisconnect(reason: string): void {
  logger.warn({ reason, provider: activeSession?.provider }, "Stream provider disconnected");

  if (activeSession) {
    activeSession.status = "reconnecting";
    void updateStreamSession(activeSession.id, { status: "reconnecting" });
  }

  publish({
    eventType: "StreamDisconnected",
    source: "stream-connection-manager",
    provider: activeSession?.provider,
    sessionId: activeSession?.id,
    data: { reason },
    emittedAt: Date.now(),
  });

  const symbols = activeSession?.symbols ?? DEFAULT_SYMBOLS;
  const streamTypes = activeSession?.streamTypes ?? DEFAULT_STREAM_TYPES;
  scheduleReconnect(symbols, streamTypes);
}

// ---------------------------------------------------------------------------
// Internal: Reconnection (exponential backoff)
// ---------------------------------------------------------------------------

function scheduleReconnect(symbols: string[], streamTypes: StreamType[]): void {
  if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
    logger.error({ reconnectAttempts }, "Stream: max reconnect attempts reached — giving up");
    return;
  }

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_DELAY_MS,
  );

  reconnectAttempts++;
  logger.info({ delay, attempt: reconnectAttempts }, "Stream: scheduling reconnect");

  reconnectTimer = setTimeout(() => {
    void connect(symbols, streamTypes);
  }, delay);
}

// ---------------------------------------------------------------------------
// Internal: Health Loop
// ---------------------------------------------------------------------------

function startHealthLoop(): void {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(() => {
    void writeHealthSnapshot();
  }, HEALTH_INTERVAL_MS);
}

async function writeHealthSnapshot(): Promise<void> {
  if (!activeSession || !provider) return;

  const now = Date.now();
  const heartbeatAge = activeSession.lastHeartbeatAt
    ? (now - activeSession.lastHeartbeatAt) / 1000
    : null;

  const connectionStatus: "healthy" | "degraded" | "disconnected" | "failed" =
    heartbeatAge === null ? "disconnected"
    : heartbeatAge < 5 ? "healthy"
    : heartbeatAge < 30 ? "degraded"
    : "disconnected";

  const healthScore =
    connectionStatus === "healthy" ? 100
    : connectionStatus === "degraded" ? 60
    : 0;

  try {
    await insertStreamHealth({
      provider: activeSession.provider,
      connectionStatus,
      heartbeatAgeSeconds: heartbeatAge?.toFixed(1) ?? null,
      lastTickAgeSeconds: heartbeatAge?.toFixed(1) ?? null,
      reconnectCount: String(activeSession.reconnectCount),
      failureCount: String(totalFailures),
      subscribedSymbols: String(activeSession.symbols.length),
      healthScore: String(healthScore),
      sessionId: activeSession.id,
    });
  } catch (err) {
    logger.error({ err }, "Health snapshot write failed");
  }
}

function clearTimers(): void {
  if (healthTimer) { clearInterval(healthTimer); healthTimer = null; }
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
}
