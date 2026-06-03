import { Router } from "express";
import {
  getLatestSystemMetrics,
  listLatestServiceHealth,
  getActiveAlertCount,
  getOpenIncidentCount,
  getLatestPerformanceSnapshot,
} from "../../services/ops-db";
import { getOpsSchedulerStatus } from "../../services/ops-scheduler";

/**
 * ops-overview.ts — Platform operations overview endpoint.
 *
 * GET /v1/ops/overview — current platform health summary
 */

const router = Router();

// GET /v1/ops/overview
router.get("/ops/overview", async (req, res) => {
  try {
    const [systemMetrics, serviceRows, activeAlerts, openIncidents, latestSnapshot] = await Promise.all([
      getLatestSystemMetrics(),
      listLatestServiceHealth(),
      getActiveAlertCount(),
      getOpenIncidentCount(),
      getLatestPerformanceSnapshot(),
    ]);

    const schedulerStatus = getOpsSchedulerStatus();
    const services = serviceRows.map((r) => r.sh);

    const platformScore = latestSnapshot?.overallScore ?? null;
    const degradedServices = services.filter((s) => s.status !== "running").length;

    return res.json({
      data: {
        platformScore,
        activeAlerts,
        openIncidents,
        totalServices: services.length,
        degradedServices,
        scheduler: schedulerStatus,
        systemMetrics: systemMetrics
          ? {
              cpuPercent: systemMetrics.cpuPercent,
              memoryRssMb: systemMetrics.memoryRssMb,
              heapUsedMb: systemMetrics.heapUsedMb,
              eventLoopLagMs: systemMetrics.eventLoopLagMs,
              dbLatencyMs: systemMetrics.dbLatencyMs,
              uptimeSeconds: systemMetrics.uptimeSeconds,
              capturedAt: systemMetrics.createdAt,
            }
          : null,
        services: services.map((s) => ({
          service: s.service,
          status: s.status,
          healthScore: s.healthScore,
          message: s.message,
          checkedAt: s.createdAt,
        })),
        observations: latestSnapshot?.observations ?? [],
        snapshotAt: latestSnapshot?.createdAt ?? null,
      },
    });
  } catch (err) {
    req.log?.error({ err }, "Failed to get ops overview");
    return res.status(500).json({ error: "Failed to get ops overview" });
  }
});

export default router;
