import { logger } from "../lib/logger";
import { insertLatencyMetric, insertEventProcessingMetric } from "./stream-db";
import type { LatencyRecord } from "./stream-types";

// Rolling latency buffer for percentile computation
const latencyBuffers = new Map<string, number[]>();
const BUFFER_MAX = 1000;
const METRICS_WINDOW_SEC = 60;
let metricsTimer: NodeJS.Timeout | null = null;

export function startMetricsProcessor(): void {
  metricsTimer = setInterval(() => {
    void flushProcessingMetrics();
  }, METRICS_WINDOW_SEC * 1000);
}

export function stopMetricsProcessor(): void {
  if (metricsTimer) { clearInterval(metricsTimer); metricsTimer = null; }
}

/**
 * recordLatency — record a single latency measurement.
 * Buffers in-memory; persists to DB and computes percentiles periodically.
 */
export function recordLatency(record: LatencyRecord): void {
  const key = `${record.provider}:${record.metricType}`;
  const buf = latencyBuffers.get(key) ?? [];
  buf.push(record.valueMs);
  if (buf.length > BUFFER_MAX) buf.shift();
  latencyBuffers.set(key, buf);

  // Persist individual measurement asynchronously
  insertLatencyMetric({
    provider: record.provider,
    symbol: record.symbol ?? null,
    metricType: record.metricType,
    valueMs: record.valueMs.toFixed(3),
    exchangeTimestampMs: record.exchangeTimestampMs?.toFixed(0) ?? null,
    receiveTimestampMs: record.receiveTimestampMs?.toFixed(0) ?? null,
    processTimestampMs: record.processTimestampMs?.toFixed(0) ?? null,
    storeTimestampMs: record.storeTimestampMs?.toFixed(0) ?? null,
    sessionId: record.sessionId ?? null,
  }).catch((err) => logger.error({ err }, "Metrics: latency insert failed"));
}

export function getLatencyStats(
  provider: string,
  metricType: string,
): { avg: number; min: number; max: number; p95: number; p99: number; count: number } | null {
  const key = `${provider}:${metricType}`;
  const buf = latencyBuffers.get(key);
  if (!buf || buf.length === 0) return null;

  const sorted = [...buf].sort((a, b) => a - b);
  const count = sorted.length;
  const avg = sorted.reduce((a, b) => a + b, 0) / count;
  const min = sorted[0]!;
  const max = sorted[count - 1]!;
  const p95 = sorted[Math.floor(count * 0.95)]!;
  const p99 = sorted[Math.floor(count * 0.99)]!;

  return { avg, min, max, p95, p99, count };
}

export function getAllLatencyStats(): Record<string, ReturnType<typeof getLatencyStats>> {
  const result: Record<string, ReturnType<typeof getLatencyStats>> = {};
  for (const key of latencyBuffers.keys()) {
    const [provider, metricType] = key.split(":");
    if (provider && metricType) {
      result[key] = getLatencyStats(provider, metricType);
    }
  }
  return result;
}

async function flushProcessingMetrics(): Promise<void> {
  const windowStart = new Date(Date.now() - METRICS_WINDOW_SEC * 1000);
  const windowEnd = new Date();

  for (const [key, buf] of latencyBuffers) {
    if (buf.length === 0) continue;
    const [provider, metricType] = key.split(":");
    if (!provider || !metricType) continue;

    const sorted = [...buf].sort((a, b) => a - b);
    const count = sorted.length;
    const mean = sorted.reduce((a, b) => a + b, 0) / count;
    const throughput = count / METRICS_WINDOW_SEC;

    try {
      await insertEventProcessingMetric({
        eventType: metricType,
        processor: provider,
        windowSeconds: String(METRICS_WINDOW_SEC),
        eventCount: String(count),
        errorCount: "0",
        minMs: sorted[0]!.toFixed(2),
        maxMs: sorted[count - 1]!.toFixed(2),
        meanMs: mean.toFixed(2),
        p50Ms: sorted[Math.floor(count * 0.5)]!.toFixed(2),
        p95Ms: sorted[Math.floor(count * 0.95)]!.toFixed(2),
        p99Ms: sorted[Math.floor(count * 0.99)]!.toFixed(2),
        throughput: throughput.toFixed(2),
        windowStart,
        windowEnd,
      });
    } catch (err) {
      logger.error({ err }, "Metrics: processing metric insert failed");
    }
  }
}
