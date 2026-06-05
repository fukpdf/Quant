import { Router } from "express";
import {
  getStreamSessions,
  getStreamFailures,
  getLatencyMetrics,
  getLatencyStats,
  getEventProcessingMetrics,
  getRecoveryEvents,
  getStreamAuditLog,
} from "../../services/stream-db";
import {
  getStreamStatus,
  isStreaming,
} from "../../services/stream-connection-manager";
import {
  getProviderHealth,
  getAllProviderHealth,
} from "../../services/stream-health-engine";
import { getAllLatencyStats } from "../../services/stream-metrics-processor";
import { StreamProviderFactory } from "../../services/stream-provider-factory";

const router = Router();

/** GET /v1/streams/status — current streaming infrastructure status */
router.get("/streams/status", async (req, res) => {
  try {
    const status = getStreamStatus();
    res.json({
      data: {
        streaming: status.streaming,
        provider: status.provider ?? StreamProviderFactory.getProviderName(),
        sessionId: status.session?.id ?? null,
        symbols: status.session?.symbols ?? [],
        streamTypes: status.session?.streamTypes ?? [],
        ticksReceived: status.session?.ticksReceived ?? 0,
        eventsProcessed: status.session?.eventsProcessed ?? 0,
        reconnectAttempts: status.reconnectAttempts,
        totalFailures: status.totalFailures,
        uptime: status.session
          ? Math.floor((Date.now() - status.session.startedAt) / 1000)
          : 0,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/status failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get stream status" } });
  }
});

/** GET /v1/streams/providers — available streaming providers */
router.get("/streams/providers", (_req, res) => {
  const active = StreamProviderFactory.getProviderName();
  res.json({
    data: {
      active,
      available: [
        {
          name: "mock",
          description: "Synthetic data provider (no network, no API key required)",
          status: "available",
          requiresApiKey: false,
        },
        {
          name: "binance",
          description: "Binance WebSocket combined stream (crypto)",
          status: "available",
          requiresApiKey: false,
          note: "Requires ws package: pnpm --filter @workspace/api-server add ws",
        },
        {
          name: "forex",
          description: "Forex streaming (future phase stub)",
          status: "not_implemented",
          requiresApiKey: true,
        },
        {
          name: "equities",
          description: "Equities streaming (future phase stub)",
          status: "not_implemented",
          requiresApiKey: true,
        },
      ],
    },
  });
});

/** GET /v1/streams/health — per-provider health status */
router.get("/streams/health", async (req, res): Promise<void> => {
  try {
    const { provider } = req.query as { provider?: string };
    if (provider) {
      const health = await getProviderHealth(provider);
      return void res.json({ data: health });
    }
    const all = await getAllProviderHealth();
    res.json({ data: all });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/health failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get stream health" } });
  }
});

/** GET /v1/streams/sessions — stream session history */
router.get("/streams/sessions", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const sessions = await getStreamSessions(limit);
    res.json({ data: sessions, total: sessions.length });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/sessions failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get sessions" } });
  }
});

/** GET /v1/streams/failures — stream failure events */
router.get("/streams/failures", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
    const failures = await getStreamFailures(limit);
    res.json({ data: failures, total: failures.length });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/failures failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get failures" } });
  }
});

/** GET /v1/streams/latency — latency metrics */
router.get("/streams/latency", async (req, res): Promise<void> => {
  try {
    const { provider, metricType, summary } = req.query as {
      provider?: string;
      metricType?: string;
      summary?: string;
    };

    if (summary === "true") {
      const stats = getAllLatencyStats();
      return void res.json({ data: stats });
    }

    const limit = Math.min(Number(req.query["limit"] ?? 200), 1000);
    const metrics = await getLatencyMetrics(provider, metricType, limit);
    res.json({ data: metrics, total: metrics.length });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/latency failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get latency metrics" } });
  }
});

/** GET /v1/streams/metrics — event processing metrics */
router.get("/streams/metrics", async (req, res) => {
  try {
    const { processor } = req.query as { processor?: string };
    const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
    const metrics = await getEventProcessingMetrics(processor, limit);
    res.json({ data: metrics, total: metrics.length });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/metrics failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get metrics" } });
  }
});

/** GET /v1/streams/recovery — stream recovery events */
router.get("/streams/recovery", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const events = await getRecoveryEvents(limit);
    res.json({ data: events, total: events.length });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/recovery failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get recovery events" } });
  }
});

/** GET /v1/streams/audit — immutable stream audit log */
router.get("/streams/audit", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 200), 1000);
    const entries = await getStreamAuditLog(limit);
    res.json({ data: entries, total: entries.length });
  } catch (err) {
    req.log?.error({ err }, "GET /streams/audit failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get audit log" } });
  }
});

export default router;
