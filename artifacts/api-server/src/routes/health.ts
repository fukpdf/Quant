import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// /healthz — Legacy simple health check (Phase 1 contract — never remove)
// ---------------------------------------------------------------------------

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// ---------------------------------------------------------------------------
// /health/live — Kubernetes-style liveness probe
//
// Returns 200 as long as the process is alive. Must NOT check external deps.
// ---------------------------------------------------------------------------

router.get("/health/live", (_req, res) => {
  res.json({
    status: "alive",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    pid: process.pid,
  });
});

// ---------------------------------------------------------------------------
// /health/ready — Kubernetes-style readiness probe
//
// Returns 200 when ready to accept traffic (DB connected, memory ok).
// Returns 503 when not ready — load balancers should stop sending traffic.
// ---------------------------------------------------------------------------

router.get("/health/ready", async (_req, res) => {
  const checks: Record<string, "ok" | "error"> = {};
  let ready = true;

  // Database connectivity
  try {
    await db.execute("SELECT 1" as unknown as Parameters<typeof db.execute>[0]);
    checks["database"] = "ok";
  } catch {
    checks["database"] = "error";
    ready = false;
  }

  // Event loop responsiveness (fail if lag >= 2s — indicates severe blockage)
  const loopLag = await measureEventLoopLag();
  checks["eventLoop"] = loopLag < 2000 ? "ok" : "error";
  if (loopLag >= 2000) ready = false;

  // Memory pressure (fail if heap >= 95%)
  const mem = process.memoryUsage();
  const heapUtilization = mem.heapUsed / mem.heapTotal;
  checks["memory"] = heapUtilization < 0.95 ? "ok" : "error";
  if (heapUtilization >= 0.95) ready = false;

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "unavailable",
    timestamp: new Date().toISOString(),
    checks,
    uptime: Math.floor(process.uptime()),
  });
});

// ---------------------------------------------------------------------------
// /health/dependencies — Detailed per-dependency health
//
// Used by monitoring systems. Slower than /live or /ready — not suitable for
// high-frequency probes.
// ---------------------------------------------------------------------------

router.get("/health/dependencies", async (_req, res) => {
  const startedAt = Date.now();
  const dependencies: Record<string, {
    status: "healthy" | "degraded" | "unavailable";
    latencyMs?: number;
    detail?: string;
  }> = {};

  // Database
  try {
    const dbStart = Date.now();
    await db.execute("SELECT 1" as unknown as Parameters<typeof db.execute>[0]);
    const dbLatencyMs = Date.now() - dbStart;
    dependencies["database"] = {
      status: dbLatencyMs < 1000 ? "healthy" : "degraded",
      latencyMs: dbLatencyMs,
      detail: dbLatencyMs < 1000 ? "Connected" : "High latency",
    };
  } catch (err) {
    dependencies["database"] = {
      status: "unavailable",
      detail: err instanceof Error ? err.message : "Connection failed",
    };
  }

  // AI provider
  const aiProvider = process.env["AI_PROVIDER"] ?? "mock";
  dependencies["aiProvider"] = {
    status: "healthy",
    detail: `Provider: ${aiProvider}${aiProvider === "mock" ? " (no external dependency)" : ""}`,
  };

  // Stream provider
  const streamEnabled = process.env["STREAM_ENABLED"] !== "false";
  const streamProvider = process.env["STREAM_PROVIDER"] ?? "mock";
  dependencies["streamProvider"] = {
    status: streamEnabled ? "healthy" : "degraded",
    detail: streamEnabled ? `Provider: ${streamProvider}, enabled` : "Disabled (STREAM_ENABLED=false)",
  };

  // Execution engine
  const executionEnabled = process.env["EXECUTION_ENABLED"] !== "false";
  const executionMode = process.env["EXECUTION_MODE"] ?? "simulation";
  dependencies["executionEngine"] = {
    status: executionEnabled ? "healthy" : "degraded",
    detail: executionEnabled ? `Mode: ${executionMode}` : "Disabled (EXECUTION_ENABLED=false)",
  };

  // Billing
  const billingMode = process.env["BILLING_MODE"] ?? "offline";
  const stripeConfigured = !!process.env["STRIPE_SECRET_KEY"];
  dependencies["billing"] = {
    status: billingMode === "offline" || stripeConfigured ? "healthy" : "degraded",
    detail: billingMode === "offline"
      ? "Offline mode (no Stripe dependency)"
      : stripeConfigured ? "Stripe configured" : "Live billing but STRIPE_SECRET_KEY missing",
  };

  // Memory
  const mem = process.memoryUsage();
  const heapUsedMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const heapUtil = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  dependencies["memory"] = {
    status: heapUtil < 80 ? "healthy" : heapUtil < 95 ? "degraded" : "unavailable",
    detail: `Heap: ${heapUsedMb}MB / ${heapTotalMb}MB (${heapUtil}%)`,
  };

  // Event loop
  const loopLag = await measureEventLoopLag();
  dependencies["eventLoop"] = {
    status: loopLag < 100 ? "healthy" : loopLag < 1000 ? "degraded" : "unavailable",
    latencyMs: loopLag,
    detail: `Event loop lag: ${loopLag}ms`,
  };

  const allStatuses = Object.values(dependencies).map(d => d.status);
  const overallStatus = allStatuses.every(s => s === "healthy")
    ? "healthy"
    : allStatuses.some(s => s === "unavailable")
    ? "degraded"
    : "degraded";

  res.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checkDurationMs: Date.now() - startedAt,
    uptime: Math.floor(process.uptime()),
    nodeVersion: process.version,
    environment: process.env["NODE_ENV"] ?? "development",
    dependencies,
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function measureEventLoopLag(): Promise<number> {
  return new Promise(resolve => {
    const start = Date.now();
    setImmediate(() => resolve(Date.now() - start));
  });
}

export default router;
