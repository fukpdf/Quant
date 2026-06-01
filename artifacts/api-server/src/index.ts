import app from "./app";
import { logger } from "./lib/logger";
import { seedMarkets } from "./services/market-data";
import { seedProviders } from "./services/providers-db";
import { startScheduler } from "./ingestion/scheduler";
import { seedStrategyDefinitions } from "./services/research-db";
import { startPaperScheduler } from "./services/paper-scheduler";
import { seedDefaultRiskProfiles } from "./services/risk-profile-service";
import { startRiskScheduler } from "./services/risk-scheduler";
import { seedDefaultBenchmarks } from "./services/benchmark-service";
import { startAnalyticsScheduler } from "./services/analytics-scheduler";
import { AiProviderFactory } from "./services/ai-provider-factory";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Seed default markets (idempotent upsert — safe to run every startup)
  try {
    await seedMarkets();
  } catch (err) {
    logger.error({ err }, "Failed to seed markets — continuing");
  }

  // Seed provider registry to DB (idempotent — safe to run every startup)
  try {
    await seedProviders();
  } catch (err) {
    logger.error({ err }, "Failed to seed providers — continuing");
  }

  // Seed strategy definitions (Phase 3 — idempotent)
  try {
    await seedStrategyDefinitions();
  } catch (err) {
    logger.error({ err }, "Failed to seed strategy definitions — continuing");
  }

  // Start all background scheduler loops (ingestion, health checks, quality checks)
  startScheduler();

  // Start paper trading scheduler (Phase 5 — signal processing, MTM, snapshots, alerts)
  startPaperScheduler();

  // Seed default risk profiles (Phase 6 — idempotent)
  try {
    await seedDefaultRiskProfiles();
  } catch (err) {
    logger.error({ err }, "Failed to seed risk profiles — continuing");
  }

  // Start risk engine scheduler (Phase 6 — snapshots, correlation, scoring, drawdown monitor)
  startRiskScheduler();

  // Seed default benchmarks (Phase 7 — BTC, ETH, SOL)
  try {
    await seedDefaultBenchmarks();
  } catch (err) {
    logger.error({ err }, "Failed to seed default benchmarks — continuing");
  }

  // Start analytics scheduler (Phase 7 — performance, health, attribution, allocation, recommendations)
  startAnalyticsScheduler();

  // Initialize AI provider (Phase 8 — logs which provider is active on startup)
  const aiProvider = AiProviderFactory.getProvider();
  logger.info({ provider: aiProvider.name, model: aiProvider.defaultModel }, "AI Research Assistant initialized");
});
