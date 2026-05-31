import { eq, and } from "drizzle-orm";
import { db, marketsTable, marketMetadataTable, marketProvidersTable } from "@workspace/db";
import type { Market } from "@workspace/db";

export type MarketRegistryEntry = Market & {
  providerName: string | null;
  providerStatus: string | null;
  metadata: {
    sector: string | null;
    currency: string | null;
    timezone: string | null;
    marketCapUsd: string | null;
  } | null;
};

export type MarketRegistryFilters = {
  type?: string;
  active?: boolean;
  provider?: string;
};

/**
 * Returns the full market registry — markets joined with metadata and
 * provider information. Providers are looked up via the exchange field
 * on each market row.
 *
 * This is a read-heavy, relatively infrequent query (dashboard display).
 * We deliberately do separate queries rather than a complex join to keep
 * the Drizzle code readable and maintainable.
 */
export async function listMarketRegistry(
  filters?: MarketRegistryFilters,
): Promise<MarketRegistryEntry[]> {
  // 1. Fetch markets matching filters
  const conditions = [];
  if (filters?.type) {
    conditions.push(eq(marketsTable.type, filters.type));
  }
  if (filters?.active !== undefined) {
    conditions.push(eq(marketsTable.active, filters.active));
  }

  const markets =
    conditions.length > 0
      ? await db.select().from(marketsTable).where(and(...conditions))
      : await db.select().from(marketsTable);

  if (markets.length === 0) return [];

  // 2. Fetch all metadata rows in one query
  const allMetadata = await db.select().from(marketMetadataTable);
  const metadataBySymbol = new Map(allMetadata.map((m) => [m.symbol, m]));

  // 3. Fetch all providers in one query
  const allProviders = await db.select().from(marketProvidersTable);
  const providerByName = new Map(allProviders.map((p) => [p.name, p]));

  // 4. Build enriched entries
  const entries: MarketRegistryEntry[] = markets
    .map((market) => {
      const meta = metadataBySymbol.get(market.symbol);
      const provider = providerByName.get(market.exchange);

      return {
        ...market,
        providerName: provider?.name ?? null,
        providerStatus: provider?.status ?? null,
        metadata: meta
          ? {
              sector: meta.sector,
              currency: meta.currency,
              timezone: meta.timezone,
              marketCapUsd: meta.marketCapUsd,
            }
          : null,
      };
    })
    .filter((entry) => {
      // Apply provider filter after join
      if (filters?.provider) {
        return entry.providerName === filters.provider;
      }
      return true;
    });

  return entries;
}
