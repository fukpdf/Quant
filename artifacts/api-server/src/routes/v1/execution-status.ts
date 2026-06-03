import { Router } from "express";
import { getOrderBookSummary } from "../../services/execution-monitor";
import { listExecutionMetrics, listExecutionSessions, listRejections, listRecoveryEvents, listExecutionAuditLog, countExecutionAuditLog, getLatencySummary } from "../../services/execution-db";
import { getAllProviderHealthStatuses, getProviderInfo } from "../../services/execution-router";
import { getExecutionMode, getCurrentSessionId } from "../../services/execution-scheduler";
import { getAnalyticsSummary } from "../../services/execution-analytics-engine";

/**
 * execution-status.ts — Execution engine status, health, sessions, metrics, latency,
 * providers, and audit-log endpoints.
 *
 * GET /v1/execution/metrics
 * GET /v1/execution/latency
 * GET /v1/execution/sessions
 * GET /v1/execution/audit-log
 * GET /v1/execution/providers
 * GET /v1/execution/health
 */

const router = Router();

// GET /v1/execution/health
router.get("/execution/health", async (req, res) => {
  try {
    const [orderSummary, providers] = await Promise.all([
      getOrderBookSummary().catch(() => ({ totalActive: 0, byStatus: {} })),
      getAllProviderHealthStatuses(),
    ]);

    const mode = getExecutionMode();
    const sessionId = getCurrentSessionId();

    return res.json({
      data: {
        executionEnabled: true,
        executionMode: mode,
        sessionId,
        activeOrders: orderSummary.totalActive,
        ordersByStatus: orderSummary.byStatus,
        providers: providers.map((p) => ({
          name: p.name,
          isReady: p.isReady,
          ordersInFlight: p.ordersInFlight,
          totalSubmitted: p.totalSubmitted,
          totalFilled: p.totalFilled,
          avgAckLatencyMs: p.avgAckLatencyMs,
        })),
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to get execution health");
    return res.status(500).json({ error: "Failed to get execution health" });
  }
});

// GET /v1/execution/providers
router.get("/execution/providers", async (_req, res) => {
  const providers = getProviderInfo();
  const healthStatuses = getAllProviderHealthStatuses();
  const activeMode = getExecutionMode();

  const merged = providers.map((p) => {
    const health = healthStatuses.find((h) => h.name === p.name);
    return {
      ...p,
      health: health
        ? {
            isReady: health.isReady,
            ordersInFlight: health.ordersInFlight,
            totalSubmitted: health.totalSubmitted,
            avgAckLatencyMs: health.avgAckLatencyMs,
          }
        : null,
    };
  });

  return res.json({
    data: { active: activeMode, providers: merged },
  });
});

// GET /v1/execution/sessions
router.get("/execution/sessions", async (req, res) => {
  const { limit = "20" } = req.query as Record<string, string>;

  try {
    const sessions = await listExecutionSessions(Math.min(parseInt(limit) || 20, 100));
    return res.json({ data: sessions, count: sessions.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list execution sessions");
    return res.status(500).json({ error: "Failed to list sessions" });
  }
});

// GET /v1/execution/metrics
router.get("/execution/metrics", async (req, res) => {
  const { mode, period = "1h", limit = "10", summary } = req.query as Record<string, string>;

  try {
    if (summary === "true") {
      const analyticsMode = mode ?? getExecutionMode();
      const summaryData = await getAnalyticsSummary(analyticsMode, period);
      return res.json({ data: summaryData });
    }

    const metrics = await listExecutionMetrics({
      mode,
      period,
      limit: Math.min(parseInt(limit) || 10, 50),
    });
    return res.json({ data: metrics, count: metrics.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to get execution metrics");
    return res.status(500).json({ error: "Failed to get metrics" });
  }
});

// GET /v1/execution/latency
router.get("/execution/latency", async (req, res) => {
  const { provider } = req.query as Record<string, string>;

  try {
    const latency = await getLatencySummary(provider);
    return res.json({ data: latency });
  } catch (err) {
    req.log?.error({ err }, "Failed to get execution latency");
    return res.status(500).json({ error: "Failed to get latency" });
  }
});

// GET /v1/execution/audit-log
router.get("/execution/audit-log", async (req, res) => {
  const { orderId, action, symbol, limit = "100", offset = "0" } = req.query as Record<string, string>;

  try {
    const [logs, total] = await Promise.all([
      listExecutionAuditLog({
        orderId,
        action,
        symbol,
        limit: Math.min(parseInt(limit) || 100, 500),
        offset: parseInt(offset) || 0,
      }),
      countExecutionAuditLog({ orderId, action }),
    ]);

    return res.json({ data: logs, total, count: logs.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to get execution audit log");
    return res.status(500).json({ error: "Failed to get audit log" });
  }
});

export default router;
