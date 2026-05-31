import { logger } from "../lib/logger";
import { ingestAllActive } from "./ingest";
import { providerRegistry } from "../providers/registry";
import { insertProviderHealthRecord, upsertProvider } from "../services/providers-db";
import { runFullQualityReport } from "../services/data-quality";

const INGESTION_INTERVAL_MS = parseInt(
  process.env["INGESTION_INTERVAL_MS"] ?? "300000",
  10,
); // default 5 minutes

const HEALTH_CHECK_INTERVAL_MS = parseInt(
  process.env["HEALTH_CHECK_INTERVAL_MS"] ?? "120000",
  10,
); // default 2 minutes

const QUALITY_CHECK_INTERVAL_MS = parseInt(
  process.env["QUALITY_CHECK_INTERVAL_MS"] ?? "3600000",
  10,
); // default 1 hour

let ingestionHandle: ReturnType<typeof setInterval> | null = null;
let healthHandle: ReturnType<typeof setInterval> | null = null;
let qualityHandle: ReturnType<typeof setInterval> | null = null;

let ingestionRunning = false;
let healthRunning = false;
let qualityRunning = false;

// ---------------------------------------------------------------------------
// Ingestion cycle
// ---------------------------------------------------------------------------

async function runIngestionCycle(): Promise<void> {
  if (ingestionRunning) {
    logger.warn("Ingestion cycle still running, skipping tick");
    return;
  }
  ingestionRunning = true;
  const start = Date.now();
  try {
    await ingestAllActive();
    logger.info({ durationMs: Date.now() - start }, "Ingestion scheduler tick done");
  } catch (err) {
    logger.error({ err }, "Ingestion cycle threw unhandled error");
  } finally {
    ingestionRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Provider health check cycle
// ---------------------------------------------------------------------------

async function runHealthChecks(): Promise<void> {
  if (healthRunning) {
    logger.warn("Health check cycle still running, skipping tick");
    return;
  }
  healthRunning = true;
  try {
    const providers = providerRegistry.list();
    logger.debug({ count: providers.length }, "Running provider health checks");

    for (const provider of providers) {
      const result = await provider.getStatus();

      // Record health in DB
      await insertProviderHealthRecord({
        providerName: provider.name,
        status: result.status,
        latencyMs: result.latencyMs,
        errorMessage:
          result.status !== "active" && result.status !== "inactive"
            ? result.message
            : null,
        checkedAt: result.checkedAt,
      });

      // Update provider status in market_providers table
      await upsertProvider({
        name: provider.name,
        displayName: provider.displayName,
        description: provider.description,
        supportedTypes: provider.supportedTypes.join(","),
        status: result.status,
        baseUrl: provider.baseUrl || null,
        requiresAuth: provider.requiresAuth,
        configJson: null,
      });

      logger.debug(
        { provider: provider.name, status: result.status, latencyMs: result.latencyMs },
        "Provider health check done",
      );
    }
  } catch (err) {
    logger.error({ err }, "Health check cycle threw unhandled error");
  } finally {
    healthRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Data quality cycle
// ---------------------------------------------------------------------------

async function runQualityCycle(): Promise<void> {
  if (qualityRunning) {
    logger.warn("Quality check cycle still running, skipping tick");
    return;
  }
  qualityRunning = true;
  const start = Date.now();
  try {
    await runFullQualityReport();
    logger.info({ durationMs: Date.now() - start }, "Quality check cycle done");
  } catch (err) {
    logger.error({ err }, "Quality check cycle threw unhandled error");
  } finally {
    qualityRunning = false;
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Start all background scheduler loops:
 * 1. Market data ingestion (default 5 min)
 * 2. Provider health checks (default 2 min)
 * 3. Data quality validation (default 1 hour)
 *
 * All loops fire an initial run 2–5 seconds after server boot to ensure
 * the DB connection pool is warm before touching the database.
 */
export function startScheduler(): void {
  if (ingestionHandle !== null) {
    logger.warn("Scheduler already running");
    return;
  }

  logger.info(
    {
      ingestionMs: INGESTION_INTERVAL_MS,
      healthMs: HEALTH_CHECK_INTERVAL_MS,
      qualityMs: QUALITY_CHECK_INTERVAL_MS,
    },
    "Starting all scheduler loops",
  );

  // Ingestion — starts after 2s
  setTimeout(() => {
    void runIngestionCycle();
    ingestionHandle = setInterval(() => void runIngestionCycle(), INGESTION_INTERVAL_MS);
  }, 2_000);

  // Health checks — starts after 3s
  setTimeout(() => {
    void runHealthChecks();
    healthHandle = setInterval(() => void runHealthChecks(), HEALTH_CHECK_INTERVAL_MS);
  }, 3_000);

  // Quality checks — starts after 15s (waits for first ingestion pass to complete)
  setTimeout(() => {
    void runQualityCycle();
    qualityHandle = setInterval(() => void runQualityCycle(), QUALITY_CHECK_INTERVAL_MS);
  }, 15_000);
}

export function stopScheduler(): void {
  if (ingestionHandle) { clearInterval(ingestionHandle); ingestionHandle = null; }
  if (healthHandle) { clearInterval(healthHandle); healthHandle = null; }
  if (qualityHandle) { clearInterval(qualityHandle); qualityHandle = null; }
  logger.info("All scheduler loops stopped");
}
