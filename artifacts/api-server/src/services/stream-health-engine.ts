import { logger } from "../lib/logger";
import { getLatestStreamHealth, getStreamSessions, getStreamFailures } from "./stream-db";
import { getStreamStatus } from "./stream-connection-manager";
import { getLatencyStats } from "./stream-metrics-processor";
import type { ProviderHealthStatus, StreamProviderName } from "./stream-types";

/**
 * stream-health-engine.ts — computes and exposes provider health status.
 *
 * Health score (0–100):
 *   40pts — connection status (healthy=40, degraded=20, disconnected=0)
 *   30pts — heartbeat freshness (< 2s=30, < 5s=20, < 10s=10, else 0)
 *   20pts — latency (< 50ms=20, < 100ms=15, < 200ms=10, < 500ms=5, else 0)
 *   10pts — reliability (1pt per 10% uptime, max 10)
 */

export async function getProviderHealth(provider: string): Promise<ProviderHealthStatus | null> {
  const streamStatus = getStreamStatus();
  const session = streamStatus.session;

  if (!session || session.provider !== provider) {
    return {
      provider: provider as StreamProviderName,
      connectionStatus: "disconnected",
      heartbeatAgeSeconds: null,
      lastTickAgeSeconds: null,
      reconnectCount: streamStatus.reconnectAttempts,
      failureCount: streamStatus.totalFailures,
      ticksPerSecond: 0,
      avgLatencyMs: null,
      p99LatencyMs: null,
      healthScore: 0,
      subscribedSymbols: 0,
      sessionId: null,
    };
  }

  const now = Date.now();
  const heartbeatAgeSeconds = session.lastHeartbeatAt
    ? (now - session.lastHeartbeatAt) / 1000
    : null;

  const connectionStatus: ProviderHealthStatus["connectionStatus"] =
    !session || session.status === "failed" ? "failed"
    : session.status !== "active" ? "disconnected"
    : heartbeatAgeSeconds === null ? "disconnected"
    : heartbeatAgeSeconds < 5 ? "healthy"
    : heartbeatAgeSeconds < 30 ? "degraded"
    : "disconnected";

  const latencyStats = getLatencyStats(provider, "end_to_end");

  const healthScore = computeHealthScore({
    connectionStatus,
    heartbeatAgeSeconds,
    avgLatencyMs: latencyStats?.avg ?? null,
    failureCount: streamStatus.totalFailures,
    reconnectCount: streamStatus.reconnectAttempts,
  });

  // Ticks per second from session metrics
  const elapsed = (now - session.startedAt) / 1000;
  const tps = elapsed > 0 ? session.ticksReceived / elapsed : 0;

  return {
    provider: provider as StreamProviderName,
    connectionStatus,
    heartbeatAgeSeconds,
    lastTickAgeSeconds: heartbeatAgeSeconds,
    reconnectCount: streamStatus.reconnectAttempts,
    failureCount: streamStatus.totalFailures,
    ticksPerSecond: Math.round(tps * 10) / 10,
    avgLatencyMs: latencyStats?.avg ?? null,
    p99LatencyMs: latencyStats?.p99 ?? null,
    healthScore,
    subscribedSymbols: session.symbols.length,
    sessionId: session.id,
  };
}

export async function getAllProviderHealth(): Promise<ProviderHealthStatus[]> {
  const status = getStreamStatus();
  const provider = status.provider ?? "mock";
  const health = await getProviderHealth(provider);
  return health ? [health] : [];
}

function computeHealthScore(params: {
  connectionStatus: ProviderHealthStatus["connectionStatus"];
  heartbeatAgeSeconds: number | null;
  avgLatencyMs: number | null;
  failureCount: number;
  reconnectCount: number;
}): number {
  const { connectionStatus, heartbeatAgeSeconds, avgLatencyMs, failureCount } = params;

  // Connection (40 pts)
  const connScore =
    connectionStatus === "healthy" ? 40
    : connectionStatus === "degraded" ? 20
    : 0;

  // Heartbeat freshness (30 pts)
  const hbScore = heartbeatAgeSeconds === null ? 0
    : heartbeatAgeSeconds < 2 ? 30
    : heartbeatAgeSeconds < 5 ? 20
    : heartbeatAgeSeconds < 10 ? 10
    : 0;

  // Latency (20 pts)
  const latScore = avgLatencyMs === null ? 15 // unknown = assume ok
    : avgLatencyMs < 50 ? 20
    : avgLatencyMs < 100 ? 15
    : avgLatencyMs < 200 ? 10
    : avgLatencyMs < 500 ? 5
    : 0;

  // Reliability (10 pts) — penalize failures
  const reliScore = Math.max(0, 10 - Math.min(failureCount, 10));

  return Math.min(100, connScore + hbScore + latScore + reliScore);
}
