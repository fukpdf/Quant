/**
 * metrics-collector.ts — Node.js process metrics collection for Phase 12.
 *
 * Collects CPU, memory, heap, event loop lag, DB latency, and API latency.
 * Writes one row to system_metrics every 30 seconds.
 */

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { insertSystemMetrics } from "./ops-db";

// ---------------------------------------------------------------------------
// Event loop lag measurement
// ---------------------------------------------------------------------------

let _lastEventLoopCheck = Date.now();
let _eventLoopLagMs = 0;

function startEventLoopMonitor() {
  function probe() {
    const now = Date.now();
    _eventLoopLagMs = now - _lastEventLoopCheck - 100;
    _lastEventLoopCheck = now;
    setTimeout(probe, 100);
  }
  setTimeout(probe, 100);
}

startEventLoopMonitor();

// ---------------------------------------------------------------------------
// CPU usage
// ---------------------------------------------------------------------------

let _prevCpuUsage = process.cpuUsage();
let _prevCpuTime = Date.now();

function measureCpuPercent(): number {
  const now = Date.now();
  const elapsed = (now - _prevCpuTime) * 1000; // μs
  const usage = process.cpuUsage(_prevCpuUsage);
  const cpuTotal = usage.user + usage.system;
  _prevCpuUsage = process.cpuUsage();
  _prevCpuTime = now;
  if (elapsed <= 0) return 0;
  return Math.min(100, (cpuTotal / elapsed) * 100);
}

// ---------------------------------------------------------------------------
// DB latency probe
// ---------------------------------------------------------------------------

async function measureDbLatencyMs(): Promise<number | null> {
  try {
    const start = Date.now();
    await db.execute(sql`select 1`);
    return Date.now() - start;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Collect and persist
// ---------------------------------------------------------------------------

export async function collectAndPersistMetrics(): Promise<void> {
  const mem = process.memoryUsage();
  const cpuPercent = measureCpuPercent();
  const dbLatencyMs = await measureDbLatencyMs();

  const rssMb = mem.rss / 1024 / 1024;
  const heapUsedMb = mem.heapUsed / 1024 / 1024;
  const heapTotalMb = mem.heapTotal / 1024 / 1024;
  const externalMb = mem.external / 1024 / 1024;
  const uptimeSeconds = Math.floor(process.uptime());
  const eventLoopLagMs = Math.max(0, _eventLoopLagMs);

  await insertSystemMetrics({
    cpuPercent: cpuPercent.toFixed(2),
    memoryRssMb: rssMb.toFixed(2),
    heapUsedMb: heapUsedMb.toFixed(2),
    heapTotalMb: heapTotalMb.toFixed(2),
    externalMb: externalMb.toFixed(2),
    eventLoopLagMs: eventLoopLagMs.toFixed(2),
    dbLatencyMs: dbLatencyMs !== null ? dbLatencyMs.toFixed(2) : null,
    uptimeSeconds: String(uptimeSeconds),
  });
}

// ---------------------------------------------------------------------------
// Current snapshot (no DB write — for inline use)
// ---------------------------------------------------------------------------

export function getCurrentMetricsSnapshot() {
  const mem = process.memoryUsage();
  return {
    cpuPercent: measureCpuPercent(),
    memoryRssMb: mem.rss / 1024 / 1024,
    heapUsedMb: mem.heapUsed / 1024 / 1024,
    heapTotalMb: mem.heapTotal / 1024 / 1024,
    externalMb: mem.external / 1024 / 1024,
    eventLoopLagMs: Math.max(0, _eventLoopLagMs),
    uptimeSeconds: Math.floor(process.uptime()),
  };
}
