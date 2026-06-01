import { logger } from "../lib/logger";
import { insertOrderbook } from "./stream-db";
import type { RawOrderBookEvent } from "./stream-types";

// Throttle: store one order book per symbol every N events to reduce DB volume
const SAMPLE_EVERY = 10;
const sampleCounters = new Map<string, number>();

export async function processOrderBook(
  event: RawOrderBookEvent,
  sessionId: string,
): Promise<void> {
  const sym = event.symbol;
  const count = (sampleCounters.get(sym) ?? 0) + 1;
  sampleCounters.set(sym, count);

  // Only persist every Nth order book update
  if (count % SAMPLE_EVERY !== 0) return;

  const bestBid = event.bestBid ? parseFloat(event.bestBid) : null;
  const bestAsk = event.bestAsk ? parseFloat(event.bestAsk) : null;
  const spread = bestBid !== null && bestAsk !== null ? bestAsk - bestBid : null;
  const spreadPct = spread !== null && bestBid !== null && bestBid > 0
    ? (spread / bestBid) * 100
    : null;

  const bidQty = event.bestBidQty ? parseFloat(event.bestBidQty) : 0;
  const askQty = event.bestAskQty ? parseFloat(event.bestAskQty) : 0;
  const totalQty = bidQty + askQty;
  const imbalance = totalQty > 0 ? (bidQty - askQty) / totalQty : null;

  const bidLiquidity = event.bids.reduce((s, [, q]) => s + parseFloat(q), 0);
  const askLiquidity = event.asks.reduce((s, [, q]) => s + parseFloat(q), 0);

  try {
    await insertOrderbook({
      symbol: sym,
      provider: event.provider,
      bestBid: event.bestBid ?? null,
      bestBidQty: event.bestBidQty ?? null,
      bestAsk: event.bestAsk ?? null,
      bestAskQty: event.bestAskQty ?? null,
      spread: spread?.toFixed(10) ?? null,
      spreadPct: spreadPct?.toFixed(6) ?? null,
      imbalance: imbalance?.toFixed(6) ?? null,
      bidLiquidity: bidLiquidity.toFixed(10),
      askLiquidity: askLiquidity.toFixed(10),
      bids: event.bids,
      asks: event.asks,
      depthLevels: String(Math.max(event.bids.length, event.asks.length)),
      sessionId,
    });
  } catch (err) {
    logger.error({ err, symbol: sym }, "Order book processor: DB insert failed");
  }
}
