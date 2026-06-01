import { logger } from "../lib/logger";
import { StreamProviderFactory } from "./stream-provider-factory";
import { startStreamManager, stopStreamManager } from "./stream-connection-manager";
import { startTickProcessor, stopTickProcessor } from "./tick-processor";
import { startMetricsProcessor, stopMetricsProcessor } from "./stream-metrics-processor";
import { startRecoveryService, stopRecoveryService } from "./stream-recovery-service";
import { auditStreamAction } from "./event-bus";

/**
 * stream-scheduler.ts — master entry point for Phase 9 streaming infrastructure.
 *
 * Called from index.ts on server startup. Starts all stream components in order:
 * 1. Metrics processor (latency tracking)
 * 2. Tick processor (DB batching)
 * 3. Recovery service (gap detection)
 * 4. Stream connection manager (WebSocket provider connection)
 *
 * Streaming is optional — server starts fine if STREAM_ENABLED=false.
 */

const STREAM_ENABLED = (process.env["STREAM_ENABLED"] ?? "true") === "true";

const DEFAULT_SYMBOLS = (process.env["STREAM_SYMBOLS"] ?? "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

let started = false;

export async function startStreamScheduler(): Promise<void> {
  if (!STREAM_ENABLED) {
    logger.info("STREAM_ENABLED=false — streaming infrastructure skipped");
    return;
  }

  if (started) {
    logger.warn("Stream scheduler already started — skipping");
    return;
  }

  started = true;

  logger.info(
    { symbols: DEFAULT_SYMBOLS, provider: StreamProviderFactory.getProviderName() },
    "Starting Phase 9 streaming infrastructure",
  );

  // 1. Metrics processor — must start before connection manager
  startMetricsProcessor();

  // 2. Tick processor — batches DB writes
  startTickProcessor();

  // 3. Recovery service — gap detection loop
  startRecoveryService();

  // 4. Connect to stream provider
  try {
    const provider = StreamProviderFactory.getProvider();
    await startStreamManager(provider, DEFAULT_SYMBOLS);

    auditStreamAction(
      "scheduler_start",
      { symbols: DEFAULT_SYMBOLS, provider: provider.name },
      provider.name,
    );

    logger.info(
      { provider: provider.name, symbols: DEFAULT_SYMBOLS },
      "Phase 9 streaming infrastructure started",
    );
  } catch (err) {
    logger.error({ err }, "Stream scheduler: failed to start stream manager — streaming unavailable");
    // Do NOT crash server — stream failure is non-fatal
  }
}

export async function stopStreamScheduler(): Promise<void> {
  stopRecoveryService();
  stopMetricsProcessor();
  stopTickProcessor();
  await stopStreamManager();
  started = false;
  logger.info("Stream scheduler stopped");
}
