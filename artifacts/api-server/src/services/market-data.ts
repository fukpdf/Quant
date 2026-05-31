import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import { db, marketsTable, candlesTable, ingestionLogsTable } from "@workspace/db";
import type { InsertCandle, InsertIngestionLog, Market } from "@workspace/db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------------

export async function listMarkets(filters?: {
  type?: string;
  active?: boolean;
}): Promise<Market[]> {
  const conditions = [];

  if (filters?.type) {
    conditions.push(eq(marketsTable.type, filters.type));
  }
  if (filters?.active !== undefined) {
    conditions.push(eq(marketsTable.active, filters.active));
  }

  const rows =
    conditions.length > 0
      ? await db.select().from(marketsTable).where(and(...conditions))
      : await db.select().from(marketsTable);

  return rows;
}

export async function upsertMarket(
  data: Omit<Market, "id" | "createdAt" | "updatedAt">,
): Promise<void> {
  await db
    .insert(marketsTable)
    .values({ ...data })
    .onConflictDoUpdate({
      target: marketsTable.symbol,
      set: {
        name: data.name,
        type: data.type,
        exchange: data.exchange,
        active: data.active,
        updatedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Candles
// ---------------------------------------------------------------------------

export type CandleQuery = {
  symbol: string;
  interval: string;
  limit?: number;
  startTime?: Date;
  endTime?: Date;
};

export async function insertCandles(candles: InsertCandle[]): Promise<number> {
  if (candles.length === 0) return 0;

  // Insert in batches of 500 to stay within PostgreSQL parameter limits
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < candles.length; i += BATCH_SIZE) {
    const batch = candles.slice(i, i + BATCH_SIZE);
    const result = await db
      .insert(candlesTable)
      .values(batch)
      .onConflictDoNothing()
      .returning({ id: candlesTable.id });

    inserted += result.length;
  }

  return inserted;
}

export async function queryCandles(query: CandleQuery) {
  const conditions = [
    eq(candlesTable.symbol, query.symbol.toUpperCase()),
    eq(candlesTable.interval, query.interval),
  ];

  if (query.startTime) {
    conditions.push(gte(candlesTable.timestamp, query.startTime));
  }
  if (query.endTime) {
    conditions.push(lte(candlesTable.timestamp, query.endTime));
  }

  const limit = Math.min(query.limit ?? 100, 500);

  const rows = await db
    .select()
    .from(candlesTable)
    .where(and(...conditions))
    .orderBy(desc(candlesTable.timestamp))
    .limit(limit);

  // Return in ascending order (oldest first) for charting conventions
  return rows.reverse();
}

export async function getLatestCandle(symbol: string) {
  const [row] = await db
    .select()
    .from(candlesTable)
    .where(eq(candlesTable.symbol, symbol.toUpperCase()))
    .orderBy(desc(candlesTable.timestamp))
    .limit(1);

  return row ?? null;
}

export async function countCandles(symbol: string, interval: string): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(
        eq(candlesTable.symbol, symbol.toUpperCase()),
        eq(candlesTable.interval, interval),
      ),
    );

  return result?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Ingestion Logs
// ---------------------------------------------------------------------------

export async function logIngestion(entry: InsertIngestionLog): Promise<void> {
  await db.insert(ingestionLogsTable).values(entry);
}

export async function listIngestionLogs(limit = 20) {
  return db
    .select()
    .from(ingestionLogsTable)
    .orderBy(desc(ingestionLogsTable.createdAt))
    .limit(Math.min(limit, 100));
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

const DEFAULT_MARKETS: Omit<Market, "id" | "createdAt" | "updatedAt">[] = [
  // Crypto — active (Binance public API, no key required)
  { symbol: "BTCUSDT", name: "Bitcoin / Tether USD", type: "crypto", exchange: "binance", active: true },
  { symbol: "ETHUSDT", name: "Ethereum / Tether USD", type: "crypto", exchange: "binance", active: true },
  { symbol: "SOLUSDT", name: "Solana / Tether USD", type: "crypto", exchange: "binance", active: true },
  { symbol: "BNBUSDT", name: "BNB / Tether USD", type: "crypto", exchange: "binance", active: true },
  // Forex — inactive until a forex provider is configured
  { symbol: "EURUSD", name: "Euro / US Dollar", type: "forex", exchange: "provider-pending", active: false },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", type: "forex", exchange: "provider-pending", active: false },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", type: "forex", exchange: "provider-pending", active: false },
];

export async function seedMarkets(): Promise<void> {
  logger.info("Seeding default markets...");
  for (const market of DEFAULT_MARKETS) {
    await upsertMarket(market);
  }
  logger.info({ count: DEFAULT_MARKETS.length }, "Markets seeded");
}
