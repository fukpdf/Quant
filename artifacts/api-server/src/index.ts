import app from "./app";
import { logger } from "./lib/logger";
import { seedMarkets } from "./services/market-data";
import { seedProviders } from "./services/providers-db";
import { startScheduler } from "./ingestion/scheduler";

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

  // Start all background scheduler loops (ingestion, health checks, quality checks)
  startScheduler();
});
