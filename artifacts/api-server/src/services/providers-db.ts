import { eq, desc } from "drizzle-orm";
import {
  db,
  marketProvidersTable,
  providerHealthTable,
} from "@workspace/db";
import type {
  MarketProvider,
  InsertMarketProvider,
  ProviderHealth,
  InsertProviderHealth,
} from "@workspace/db";
import { logger } from "../lib/logger";
import { providerRegistry } from "../providers/registry";

// ---------------------------------------------------------------------------
// Market Providers
// ---------------------------------------------------------------------------

export async function listProviders(filters?: {
  status?: string;
}): Promise<MarketProvider[]> {
  if (filters?.status) {
    return db
      .select()
      .from(marketProvidersTable)
      .where(eq(marketProvidersTable.status, filters.status));
  }
  return db.select().from(marketProvidersTable);
}

export async function getProvider(name: string): Promise<MarketProvider | null> {
  const [row] = await db
    .select()
    .from(marketProvidersTable)
    .where(eq(marketProvidersTable.name, name))
    .limit(1);
  return row ?? null;
}

export async function upsertProvider(
  data: InsertMarketProvider,
): Promise<void> {
  await db
    .insert(marketProvidersTable)
    .values(data)
    .onConflictDoUpdate({
      target: marketProvidersTable.name,
      set: {
        displayName: data.displayName,
        description: data.description,
        supportedTypes: data.supportedTypes,
        status: data.status,
        baseUrl: data.baseUrl,
        requiresAuth: data.requiresAuth,
        configJson: data.configJson,
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Provider Health
// ---------------------------------------------------------------------------

export async function insertProviderHealthRecord(
  data: InsertProviderHealth,
): Promise<void> {
  await db.insert(providerHealthTable).values(data);
}

export async function listProviderHealth(opts?: {
  providerName?: string;
  limit?: number;
}): Promise<ProviderHealth[]> {
  const limit = Math.min(opts?.limit ?? 50, 200);

  if (opts?.providerName) {
    return db
      .select()
      .from(providerHealthTable)
      .where(eq(providerHealthTable.providerName, opts.providerName))
      .orderBy(desc(providerHealthTable.checkedAt))
      .limit(limit);
  }

  return db
    .select()
    .from(providerHealthTable)
    .orderBy(desc(providerHealthTable.checkedAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

export async function seedProviders(): Promise<void> {
  logger.info("Seeding provider registry...");
  const providers = providerRegistry.list();

  for (const p of providers) {
    await upsertProvider({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      supportedTypes: p.supportedTypes.join(","),
      status: "unknown",
      baseUrl: p.baseUrl || null,
      requiresAuth: p.requiresAuth,
      configJson: null,
    });
  }

  logger.info({ count: providers.length }, "Providers seeded");
}
