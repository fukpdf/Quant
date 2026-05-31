import { logger } from "../lib/logger";
import { ingestAllActive } from "./ingest";

const INTERVAL_MS = parseInt(process.env["INGESTION_INTERVAL_MS"] ?? "300000", 10); // default 5 minutes

let schedulerHandle: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function runCycle(): Promise<void> {
  if (isRunning) {
    logger.warn("Ingestion cycle still running, skipping this tick");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    await ingestAllActive();
    logger.info({ durationMs: Date.now() - start }, "Scheduler cycle finished");
  } catch (err) {
    logger.error({ err }, "Scheduler cycle threw an unhandled error");
  } finally {
    isRunning = false;
  }
}

/**
 * Start the market data ingestion scheduler.
 *
 * - Runs an initial ingestion immediately on startup (backfill).
 * - Then repeats every INGESTION_INTERVAL_MS (default 5 minutes).
 * - Guards against overlapping runs — if a cycle is still running when the
 *   next tick fires, the new tick is skipped with a warning.
 */
export function startScheduler(): void {
  if (schedulerHandle !== null) {
    logger.warn("Scheduler already running");
    return;
  }

  logger.info(
    { intervalMs: INTERVAL_MS },
    "Starting market data ingestion scheduler",
  );

  // Run immediately (backfill on startup), then on interval
  // Use setTimeout for the first run so the server is fully initialized first
  setTimeout(() => {
    void runCycle();
    schedulerHandle = setInterval(() => void runCycle(), INTERVAL_MS);
  }, 2_000); // 2s delay so DB connection pools have time to warm up
}

export function stopScheduler(): void {
  if (schedulerHandle !== null) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
    logger.info("Scheduler stopped");
  }
}
