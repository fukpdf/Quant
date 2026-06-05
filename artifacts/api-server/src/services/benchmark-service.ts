/**
 * benchmark-service.ts
 *
 * Manages benchmark definitions and snapshot ingestion.
 * Seeds default BTC and ETH benchmarks on startup.
 * Periodically pulls latest candle prices and saves benchmark snapshots.
 */

import { db } from "@workspace/db";
import { candlesTable, portfolioBenchmarksTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  listBenchmarks,
  getBenchmark,
  createBenchmark,
  updateBenchmark,
  saveBenchmarkSnapshot,
  getLatestBenchmarkSnapshot,
  appendAnalyticsAuditLog,
} from "./analytics-db";
import { logger } from "../lib/logger";
import type { PortfolioBenchmark } from "@workspace/db";

// ---------------------------------------------------------------------------
// Seeding defaults
// ---------------------------------------------------------------------------

const DEFAULT_BENCHMARKS: Array<{
  name: string;
  benchmarkType: string;
  symbol: string;
  description: string;
  isDefault: boolean;
}> = [
  {
    name: "BTC Benchmark",
    benchmarkType: "btc",
    symbol: "BTCUSDT",
    description: "Bitcoin (BTC) as performance benchmark",
    isDefault: true,
  },
  {
    name: "ETH Benchmark",
    benchmarkType: "eth",
    symbol: "ETHUSDT",
    description: "Ethereum (ETH) as performance benchmark",
    isDefault: false,
  },
  {
    name: "SOL Benchmark",
    benchmarkType: "sol",
    symbol: "SOLUSDT",
    description: "Solana (SOL) as performance benchmark",
    isDefault: false,
  },
];

export async function seedDefaultBenchmarks(): Promise<void> {
  logger.info("Seeding default benchmarks");
  for (const def of DEFAULT_BENCHMARKS) {
    try {
      // Check if already exists by name
      const rows = await db
        .select()
        .from(portfolioBenchmarksTable)
        .where(eq(portfolioBenchmarksTable.name, def.name))
        .limit(1);
      if (rows.length === 0) {
        await createBenchmark(def);
        logger.info({ name: def.name }, "Created default benchmark");
      }
    } catch (e) {
      logger.warn({ e, name: def.name }, "Failed to seed benchmark");
    }
  }
}

// ---------------------------------------------------------------------------
// Snapshot refresh
// ---------------------------------------------------------------------------

export async function refreshBenchmarkSnapshots(): Promise<void> {
  const start = Date.now();
  logger.info("Refreshing benchmark snapshots");

  const benchmarks = await listBenchmarks(true);
  let successCount = 0;

  for (const bm of benchmarks) {
    if (!bm.symbol) continue;
    try {
      await refreshSingleBenchmark(bm);
      successCount++;
    } catch (e) {
      logger.warn({ e, benchmarkId: bm.id, symbol: bm.symbol }, "Failed to refresh benchmark snapshot");
    }
  }

  await appendAnalyticsAuditLog({
    actor: "scheduler",
    action: "benchmark.refresh",
    result: "success",
    durationMs: String(Date.now() - start),
    payload: { benchmarksProcessed: benchmarks.length, successCount },
  });

  logger.info({ successCount, total: benchmarks.length }, "Benchmark snapshots refreshed");
}

async function refreshSingleBenchmark(bm: PortfolioBenchmark): Promise<void> {
  if (!bm.symbol) return;

  // Get the latest candle for this symbol
  const candles = await db
    .select()
    .from(candlesTable)
    .where(and(
      eq(candlesTable.symbol, bm.symbol),
      eq(candlesTable.interval, "1d"),
    ))
    .orderBy(desc(candlesTable.timestamp))
    .limit(2);

  if (candles.length === 0) return;

  const latestCandle = candles[0]!;
  const latestPrice = parseFloat(latestCandle.close);
  const snapshotAt = new Date(latestCandle.timestamp);

  // Get previous snapshot for cumulative return calc
  const prevSnap = await getLatestBenchmarkSnapshot(bm.id);
  let periodReturn = 0;
  let cumulativeReturn = 0;

  if (prevSnap) {
    const prevPrice = parseFloat(prevSnap.price);
    periodReturn = prevPrice > 0 ? (latestPrice - prevPrice) / prevPrice : 0;
    cumulativeReturn = parseFloat(prevSnap.cumulativeReturnPct ?? "0") / 100 + periodReturn;
  }

  // Save snapshot
  await saveBenchmarkSnapshot({
    benchmarkId: bm.id,
    snapshotAt,
    price: String(latestPrice),
    periodReturnPct: String(periodReturn * 100),
    cumulativeReturnPct: String(cumulativeReturn * 100),
  });

  // Update benchmark's latest price and computed metrics
  // Compute 30d and 90d returns from recent candles
  const candles90 = await db
    .select()
    .from(candlesTable)
    .where(and(
      eq(candlesTable.symbol, bm.symbol),
      eq(candlesTable.interval, "1d"),
    ))
    .orderBy(desc(candlesTable.timestamp))
    .limit(91);

  let return30d = 0, return90d = 0, volatility = 0, benchMaxDD = 0;

  if (candles90.length >= 30) {
    const prices = candles90.map(c => parseFloat(c.close)).reverse();
    const current = prices[prices.length - 1]!;

    if (prices.length >= 30) {
      return30d = (current / prices[prices.length - 30]!) - 1;
    }
    if (prices.length >= 90) {
      return90d = (current / prices[prices.length - 90]!) - 1;
    }

    // Annualized volatility from daily returns
    const dailyR: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      dailyR.push((prices[i]! - prices[i - 1]!) / prices[i - 1]!);
    }
    if (dailyR.length > 1) {
      const mean = dailyR.reduce((a, b) => a + b, 0) / dailyR.length;
      const variance = dailyR.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / dailyR.length;
      volatility = Math.sqrt(variance) * Math.sqrt(252) * 100;
    }

    // Max drawdown
    let peak = prices[0]!;
    for (const p of prices) {
      if (p > peak) peak = p;
      const dd = (peak - p) / peak;
      if (dd > benchMaxDD) benchMaxDD = dd;
    }
  }

  await updateBenchmark(bm.id, {
    latestPrice: String(latestPrice),
    latestPriceAt: snapshotAt,
    return30dPct: String(return30d * 100),
    return90dPct: String(return90d * 100),
    volatilityPct: String(volatility),
    maxDrawdownPct: String(benchMaxDD * 100),
  });
}

// ---------------------------------------------------------------------------
// Re-export for route use
// ---------------------------------------------------------------------------
export { listBenchmarks, getBenchmark, createBenchmark };
