import { db } from "@workspace/db";
import { systemMetricsTable } from "@workspace/db/schema";
import { desc, gte, and } from "drizzle-orm";
import { logger } from "../lib/logger";

/**
 * performance-profiler.ts — API and query performance profiling infrastructure.
 *
 * Tracks:
 *  - API endpoint latency (rolling window with p50/p95/p99)
 *  - DB query latency histogram
 *  - Scheduler execution timing
 *  - Memory consumption trends
 *  - Cache effectiveness (hit/miss ratio)
 *
 * Data is stored in-memory for real-time access and periodically snapshotted
 * to the system_metrics table for historical analysis.
 */

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

interface LatencySample {
  path: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
}

interface QuerySample {
  operation: string;
  durationMs: number;
  timestamp: number;
}

interface ProfilerSnapshot {
  timestamp: string;
  apiLatency: LatencyReport;
  dbLatency: LatencyReport;
  schedulerLatency: Record<string, LatencyReport>;
  memory: MemoryReport;
  cache: CacheReport;
}

interface LatencyReport {
  sampleCount: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

interface MemoryReport {
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  externalMb: number;
  heapUtilizationPct: number;
}

interface CacheReport {
  hits: number;
  misses: number;
  hitRate: number;
}

const WINDOW_MS = 5 * 60 * 1000; // 5-minute rolling window
const MAX_SAMPLES = 10000;

let apiSamples: LatencySample[] = [];
let dbSamples: QuerySample[] = [];
const schedulerSamples: Record<string, number[]> = {};
let cacheHits = 0;
let cacheMisses = 0;

const snapshots: ProfilerSnapshot[] = [];
const MAX_SNAPSHOTS = 288; // 24 hours at 5-min intervals

// ---------------------------------------------------------------------------
// Recording API
// ---------------------------------------------------------------------------

export function recordApiLatency(path: string, method: string, statusCode: number, durationMs: number): void {
  apiSamples.push({ path, method, statusCode, durationMs, timestamp: Date.now() });
  // Trim to window and size limits
  const cutoff = Date.now() - WINDOW_MS;
  apiSamples = apiSamples.filter(s => s.timestamp >= cutoff).slice(-MAX_SAMPLES);
}

export function recordQueryLatency(operation: string, durationMs: number): void {
  dbSamples.push({ operation, durationMs, timestamp: Date.now() });
  const cutoff = Date.now() - WINDOW_MS;
  dbSamples = dbSamples.filter(s => s.timestamp >= cutoff).slice(-MAX_SAMPLES);
}

export function recordSchedulerLatency(schedulerName: string, durationMs: number): void {
  if (!schedulerSamples[schedulerName]) schedulerSamples[schedulerName] = [];
  schedulerSamples[schedulerName].push(durationMs);
  // Keep last 100 samples per scheduler
  if ((schedulerSamples[schedulerName]?.length ?? 0) > 100) {
    schedulerSamples[schedulerName] = schedulerSamples[schedulerName]?.slice(-100) ?? [];
  }
}

export function recordCacheHit(): void { cacheHits++; }
export function recordCacheMiss(): void { cacheMisses++; }

// ---------------------------------------------------------------------------
// Snapshot & reporting
// ---------------------------------------------------------------------------

export function takeSnapshot(): ProfilerSnapshot {
  const snapshot: ProfilerSnapshot = {
    timestamp: new Date().toISOString(),
    apiLatency: computeLatencyReport(apiSamples.map(s => s.durationMs)),
    dbLatency: computeLatencyReport(dbSamples.map(s => s.durationMs)),
    schedulerLatency: Object.fromEntries(
      Object.entries(schedulerSamples).map(([name, samples]) => [name, computeLatencyReport(samples)]),
    ),
    memory: getMemoryReport(),
    cache: getCacheReport(),
  };

  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();

  return snapshot;
}

export function getCurrentSnapshot(): ProfilerSnapshot {
  return takeSnapshot();
}

export function getSnapshotHistory(limit = 60): ProfilerSnapshot[] {
  return snapshots.slice(-limit);
}

export function getApiLatencyByPath(limit = 20): Array<{ path: string; method: string; p95Ms: number; p99Ms: number; sampleCount: number }> {
  const byPath = new Map<string, number[]>();

  for (const sample of apiSamples) {
    const key = `${sample.method} ${sample.path}`;
    const existing = byPath.get(key) ?? [];
    existing.push(sample.durationMs);
    byPath.set(key, existing);
  }

  const result = Array.from(byPath.entries()).map(([key, samples]) => {
    const [method, ...pathParts] = key.split(" ");
    const report = computeLatencyReport(samples);
    return {
      path: pathParts.join(" "),
      method: method ?? "GET",
      p95Ms: report.p95Ms,
      p99Ms: report.p99Ms,
      sampleCount: report.sampleCount,
    };
  });

  return result.sort((a, b) => b.p95Ms - a.p95Ms).slice(0, limit);
}

export async function getSystemMetricsHistory(hours = 1): Promise<typeof systemMetricsTable.$inferSelect[]> {
  const since = new Date(Date.now() - hours * 3600000);
  return db
    .select()
    .from(systemMetricsTable)
    .where(and(gte(systemMetricsTable.createdAt, since)))
    .orderBy(desc(systemMetricsTable.createdAt))
    .limit(120);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeLatencyReport(samples: number[]): LatencyReport {
  if (samples.length === 0) {
    return { sampleCount: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0, avgMs: 0, minMs: 0, maxMs: 0 };
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const len = sorted.length;
  const avg = sorted.reduce((sum, v) => sum + v, 0) / len;

  return {
    sampleCount: len,
    p50Ms: Math.round(sorted[Math.floor(len * 0.5)] ?? 0),
    p95Ms: Math.round(sorted[Math.floor(len * 0.95)] ?? 0),
    p99Ms: Math.round(sorted[Math.floor(len * 0.99)] ?? 0),
    avgMs: Math.round(avg),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[len - 1] ?? 0,
  };
}

function getMemoryReport(): MemoryReport {
  const mem = process.memoryUsage();
  const toMb = (bytes: number) => Math.round(bytes / 1024 / 1024 * 10) / 10;

  return {
    heapUsedMb: toMb(mem.heapUsed),
    heapTotalMb: toMb(mem.heapTotal),
    rssMb: toMb(mem.rss),
    externalMb: toMb(mem.external),
    heapUtilizationPct: Math.round((mem.heapUsed / mem.heapTotal) * 100),
  };
}

function getCacheReport(): CacheReport {
  const total = cacheHits + cacheMisses;
  return {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? Math.round((cacheHits / total) * 100) : 0,
  };
}

// ---------------------------------------------------------------------------
// Profiler middleware factory
// ---------------------------------------------------------------------------

export function createProfilingMiddleware() {
  return function profilingMiddleware(
    req: { method: string; path: string },
    res: { statusCode: number; on: (event: string, cb: () => void) => void },
    next: () => void,
  ): void {
    const startMs = Date.now();
    res.on("finish", () => {
      recordApiLatency(req.path, req.method, res.statusCode, Date.now() - startMs);
    });
    next();
  };
}

// ---------------------------------------------------------------------------
// Snapshot scheduler integration
// ---------------------------------------------------------------------------

let snapshotIntervalId: ReturnType<typeof setInterval> | null = null;

export function startProfilingSnapshots(intervalMs = 5 * 60 * 1000): void {
  snapshotIntervalId = setInterval(() => {
    try {
      takeSnapshot();
    } catch (err) {
      logger.error({ err }, "Performance profiler: snapshot failed");
    }
  }, intervalMs);

  logger.info({ intervalMs }, "Performance profiler: snapshot loop started");
}

export function stopProfilingSnapshots(): void {
  if (snapshotIntervalId) clearInterval(snapshotIntervalId);
}
