import { logger } from "../lib/logger";
import { insertTick } from "./stream-db";
import { recordLatency } from "./stream-metrics-processor";
import type { RawTickEvent } from "./stream-types";

/** Batch size: write ticks to DB in batches to reduce DB load */
const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 2_000;

const tickBatch: Array<{
  tick: RawTickEvent;
  sessionId: string;
  receivedAt: number;
}> = [];

let flushTimer: NodeJS.Timeout | null = null;

export function startTickProcessor(): void {
  flushTimer = setInterval(() => {
    void flushBatch();
  }, FLUSH_INTERVAL_MS);
}

export function stopTickProcessor(): void {
  if (flushTimer) { clearInterval(flushTimer); flushTimer = null; }
  void flushBatch();
}

/**
 * processTick — queues a tick for DB persistence.
 * Does NOT await DB write; batching handles it asynchronously.
 */
export async function processTick(event: RawTickEvent, sessionId: string): Promise<void> {
  tickBatch.push({ tick: event, sessionId, receivedAt: Date.now() });
  if (tickBatch.length >= BATCH_SIZE) {
    void flushBatch();
  }
}

async function flushBatch(): Promise<void> {
  if (tickBatch.length === 0) return;

  const batch = tickBatch.splice(0, tickBatch.length);

  for (const { tick, sessionId, receivedAt } of batch) {
    const processedAt = Date.now();
    const latencyMs = tick.exchangeTimestamp
      ? processedAt - tick.exchangeTimestamp
      : 0;

    try {
      await insertTick({
        symbol: tick.symbol,
        provider: tick.provider,
        price: tick.price,
        bidPrice: tick.bidPrice ?? null,
        askPrice: tick.askPrice ?? null,
        spread: tick.spread ?? null,
        volume: tick.volume ?? null,
        quoteVolume: tick.quoteVolume ?? null,
        priceChangePercent: tick.priceChangePercent ?? null,
        exchangeTimestamp: tick.exchangeTimestamp ?? null,
        sessionId,
        latencyMs: latencyMs.toFixed(2),
      });

      // Record storage latency
      recordLatency({
        provider: tick.provider,
        symbol: tick.symbol,
        metricType: "storage_latency",
        valueMs: Date.now() - processedAt,
        sessionId,
      });
    } catch (err) {
      logger.error({ err, symbol: tick.symbol }, "Tick processor: DB insert failed");
    }
  }
}
