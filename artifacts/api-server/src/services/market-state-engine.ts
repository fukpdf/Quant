import { logger } from "../lib/logger";
import { insertMarketStateSnapshot } from "./stream-db";
import { publish } from "./event-bus";
import type {
  MarketState,
  RawTickEvent,
  RawOrderBookEvent,
  StreamProviderName,
} from "./stream-types";

/**
 * market-state-engine.ts — maintains the authoritative in-memory market state.
 *
 * Architecture (ADR-022):
 * - Map<symbol, MarketState> is the source of truth; always current
 * - VWAP computed via running weighted sum (reset periodically)
 * - Volatility = rolling std dev of recent price returns
 * - Momentum = exponential moving average of price changes
 * - Snapshots written to DB every SNAPSHOT_INTERVAL_MS
 */

const SNAPSHOT_INTERVAL_MS = 30_000;    // snapshot every 30 seconds
const VOLATILITY_WINDOW = 20;           // last 20 price changes for vol
const EMA_ALPHA = 0.1;                  // momentum EMA smoothing factor

const stateMap = new Map<string, MarketState>();
const priceHistory = new Map<string, number[]>();
let snapshotTimer: NodeJS.Timeout | null = null;
let sessionId: string | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function initMarketStateEngine(sid: string, provider: StreamProviderName, symbols: string[]): void {
  sessionId = sid;
  for (const symbol of symbols) {
    stateMap.set(symbol, makeEmptyState(symbol, provider));
    priceHistory.set(symbol, []);
  }
  startSnapshotLoop(provider);
  logger.info({ symbols }, "Market state engine initialized");
}

export function stopMarketStateEngine(): void {
  if (snapshotTimer) {
    clearInterval(snapshotTimer);
    snapshotTimer = null;
  }
  stateMap.clear();
  priceHistory.clear();
}

export function processTickEvent(event: RawTickEvent): void {
  const symbol = event.symbol;
  const prev = stateMap.get(symbol) ?? makeEmptyState(symbol, event.provider);
  const now = Date.now();

  const price = parseFloat(event.price);
  if (!isFinite(price) || price <= 0) return;

  // Maintain price history for volatility
  const history = priceHistory.get(symbol) ?? [];
  if (history.length > 0) {
    const ret = (price - history[history.length - 1]!) / history[history.length - 1]!;
    history.push(price);
    if (history.length > VOLATILITY_WINDOW + 1) history.shift();
    priceHistory.set(symbol, history);
  } else {
    history.push(price);
    priceHistory.set(symbol, history);
  }

  // VWAP = running average (simplified: volume-weighted mean)
  const vol = event.volume ? parseFloat(event.volume) : 0;
  const prevVol = prev.volume;
  const prevVwap = prev.vwap ?? price;
  const newVol = prevVol + vol;
  const newVwap = newVol > 0 ? (prevVwap * prevVol + price * vol) / newVol : price;

  // Momentum: EMA of price change %
  const priceChangePct = event.priceChangePercent ? parseFloat(event.priceChangePercent) : null;
  const prevMomentum = prev.momentum ?? 0;
  const newMomentum = priceChangePct !== null
    ? EMA_ALPHA * priceChangePct + (1 - EMA_ALPHA) * prevMomentum
    : prevMomentum;

  // Volatility: std dev of recent returns
  const volatility = computeVolatility(priceHistory.get(symbol) ?? []);

  // Ticks per second (rolling over last 60s — simplified: count / elapsed seconds capped at 60)
  const elapsedSec = Math.max(1, (now - (prev.lastTickAt ?? now - 1000)) / 1000);
  const ticksPerSec = Math.min(prev.ticksPerSecond * 0.9 + 1 / elapsedSec * 0.1, 1000);

  const updated: MarketState = {
    ...prev,
    lastPrice: price,
    bidPrice: event.bidPrice ? parseFloat(event.bidPrice) : prev.bidPrice,
    askPrice: event.askPrice ? parseFloat(event.askPrice) : prev.askPrice,
    spread: event.spread ? parseFloat(event.spread) : prev.spread,
    vwap: newVwap,
    volume: newVol,
    quoteVolume: prev.quoteVolume + (event.quoteVolume ? parseFloat(event.quoteVolume) : 0),
    priceChangePercent: priceChangePct ?? prev.priceChangePercent,
    momentum: newMomentum,
    volatility,
    tickCount: prev.tickCount + 1,
    ticksPerSecond: ticksPerSec,
    lastTickAt: now,
    updatedAt: now,
  };

  stateMap.set(symbol, updated);

  // Publish MarketStateUpdated event (sampled: every 10th tick to reduce bus pressure)
  if (updated.tickCount % 10 === 0) {
    publish({
      eventType: "MarketStateUpdated",
      source: "market-state-engine",
      symbol,
      provider: event.provider,
      sessionId: sessionId ?? undefined,
      data: { lastPrice: price, vwap: newVwap, momentum: newMomentum, volatility },
      emittedAt: now,
    });
  }
}

export function processOrderBookEvent(event: RawOrderBookEvent): void {
  const symbol = event.symbol;
  const prev = stateMap.get(symbol);
  if (!prev) return;

  const bestBid = event.bestBid ? parseFloat(event.bestBid) : prev.bidPrice;
  const bestAsk = event.bestAsk ? parseFloat(event.bestAsk) : prev.askPrice;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : prev.spread;

  // Order book imbalance: (bid_qty - ask_qty) / (bid_qty + ask_qty)
  const bidQty = event.bestBidQty ? parseFloat(event.bestBidQty) : 0;
  const askQty = event.bestAskQty ? parseFloat(event.bestAskQty) : 0;
  const totalQty = bidQty + askQty;
  const imbalance = totalQty > 0 ? (bidQty - askQty) / totalQty : prev.imbalance;

  stateMap.set(symbol, {
    ...prev,
    bidPrice: bestBid,
    askPrice: bestAsk,
    spread,
    imbalance,
    updatedAt: Date.now(),
  });
}

export function getMarketState(symbol: string): MarketState | null {
  return stateMap.get(symbol) ?? null;
}

export function getAllMarketStates(): MarketState[] {
  return Array.from(stateMap.values());
}

export function getTrackedSymbols(): string[] {
  return Array.from(stateMap.keys());
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeEmptyState(symbol: string, provider: StreamProviderName): MarketState {
  return {
    symbol,
    provider,
    lastPrice: null,
    bidPrice: null,
    askPrice: null,
    spread: null,
    vwap: null,
    volume: 0,
    quoteVolume: 0,
    priceChangePercent: null,
    momentum: null,
    volatility: null,
    imbalance: null,
    marketStatus: "open",
    tickCount: 0,
    ticksPerSecond: 0,
    lastTickAt: null,
    sessionId,
    updatedAt: Date.now(),
  };
}

function computeVolatility(prices: number[]): number | null {
  if (prices.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1]!;
    const curr = prices[i]!;
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  if (returns.length === 0) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance);
}

function startSnapshotLoop(provider: StreamProviderName): void {
  if (snapshotTimer) clearInterval(snapshotTimer);
  snapshotTimer = setInterval(() => {
    void persistSnapshots(provider);
  }, SNAPSHOT_INTERVAL_MS);
}

async function persistSnapshots(provider: StreamProviderName): Promise<void> {
  for (const [symbol, state] of stateMap) {
    if (state.lastPrice === null) continue;
    try {
      await insertMarketStateSnapshot({
        symbol,
        provider,
        lastPrice: state.lastPrice?.toFixed(10) ?? null,
        bidPrice: state.bidPrice?.toFixed(10) ?? null,
        askPrice: state.askPrice?.toFixed(10) ?? null,
        spread: state.spread?.toFixed(10) ?? null,
        vwap: state.vwap?.toFixed(10) ?? null,
        volume: state.volume?.toFixed(10) ?? null,
        quoteVolume: state.quoteVolume?.toFixed(10) ?? null,
        priceChangePercent: state.priceChangePercent?.toFixed(6) ?? null,
        momentum: state.momentum?.toFixed(6) ?? null,
        volatility: state.volatility?.toFixed(6) ?? null,
        imbalance: state.imbalance?.toFixed(6) ?? null,
        marketStatus: state.marketStatus,
        tickCount: String(state.tickCount),
        ticksPerSecond: state.ticksPerSecond?.toFixed(2) ?? null,
        sessionId: state.sessionId ?? null,
      });
    } catch (err) {
      logger.error({ err, symbol }, "Market state engine: snapshot failed");
    }
  }
}
