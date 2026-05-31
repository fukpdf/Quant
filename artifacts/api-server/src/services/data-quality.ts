import { eq, and, gt, sql, desc } from "drizzle-orm";
import { db, candlesTable, dataQualityChecksTable } from "@workspace/db";
import type { DataQualityCheck, InsertDataQualityCheck } from "@workspace/db";
import { logger } from "../lib/logger";
import { listMarkets } from "./market-data";

export type CheckStatus = "pass" | "fail" | "warning";

export type CheckResult = {
  checkType: string;
  status: CheckStatus;
  candleCount: number;
  issueCount: number;
  details: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/**
 * Detect candles with high < low (physically impossible).
 */
async function checkOhlcConsistency(
  symbol: string,
  interval: string,
): Promise<CheckResult> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(
        eq(candlesTable.symbol, symbol),
        eq(candlesTable.interval, interval),
        sql`cast(${candlesTable.high} as numeric) < cast(${candlesTable.low} as numeric)`,
      ),
    );

  const total = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, interval)),
    );

  const issueCount = rows[0]?.count ?? 0;
  const candleCount = total[0]?.count ?? 0;

  return {
    checkType: "ohlc_consistency",
    status: issueCount > 0 ? "fail" : "pass",
    candleCount,
    issueCount,
    details: { description: "Candles where high < low" },
  };
}

/**
 * Detect candles with timestamp > now() (future-dated candles are invalid).
 */
async function checkFutureTimestamps(
  symbol: string,
  interval: string,
): Promise<CheckResult> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(
        eq(candlesTable.symbol, symbol),
        eq(candlesTable.interval, interval),
        gt(candlesTable.timestamp, new Date()),
      ),
    );

  const total = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, interval)),
    );

  const issueCount = rows[0]?.count ?? 0;
  const candleCount = total[0]?.count ?? 0;

  return {
    checkType: "future_timestamps",
    status: issueCount > 0 ? "fail" : "pass",
    candleCount,
    issueCount,
    details: { description: "Candles with timestamp > now()" },
  };
}

/**
 * Detect zero-or-negative volume candles (suspicious but not always invalid —
 * some assets legitimately have low-volume periods, so this is a warning).
 */
async function checkInvalidVolumes(
  symbol: string,
  interval: string,
): Promise<CheckResult> {
  const rows = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(
        eq(candlesTable.symbol, symbol),
        eq(candlesTable.interval, interval),
        sql`cast(${candlesTable.volume} as numeric) <= 0`,
      ),
    );

  const total = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, interval)),
    );

  const issueCount = rows[0]?.count ?? 0;
  const candleCount = total[0]?.count ?? 0;

  // Warning rather than fail — zero volume is unusual but not always wrong
  return {
    checkType: "invalid_volumes",
    status: issueCount > 0 ? "warning" : "pass",
    candleCount,
    issueCount,
    details: { description: "Candles with volume <= 0" },
  };
}

/**
 * Detect duplicate candles (same symbol+interval+timestamp).
 * Should always be 0 due to the uniqueIndex, but validates DB integrity.
 */
async function checkDuplicateCandles(
  symbol: string,
  interval: string,
): Promise<CheckResult> {
  const rows = await db.execute<{ dup_count: number }>(
    sql`
      SELECT COALESCE(SUM(cnt - 1), 0)::integer AS dup_count
      FROM (
        SELECT COUNT(*) AS cnt
        FROM candles
        WHERE symbol = ${symbol}
          AND interval = ${interval}
        GROUP BY symbol, interval, timestamp
        HAVING COUNT(*) > 1
      ) t
    `,
  );

  const total = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(candlesTable)
    .where(
      and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, interval)),
    );

  const issueCount = (rows.rows[0]?.dup_count as number) ?? 0;
  const candleCount = total[0]?.count ?? 0;

  return {
    checkType: "duplicate_candles",
    status: issueCount > 0 ? "fail" : "pass",
    candleCount,
    issueCount,
    details: { description: "Duplicate candles sharing same (symbol, interval, timestamp)" },
  };
}

/**
 * Detect timestamp gaps — check that the gap between consecutive candles
 * matches the expected interval.
 * Only checks the most recent 200 candles for performance.
 */
async function checkTimestampGaps(
  symbol: string,
  interval: string,
): Promise<CheckResult> {
  // Map interval to expected gap in seconds
  const INTERVAL_SECONDS: Record<string, number> = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "4h": 14400, "1d": 86400, "1w": 604800,
  };
  const expectedGapSec = INTERVAL_SECONDS[interval];

  if (!expectedGapSec) {
    const total = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(candlesTable)
      .where(
        and(eq(candlesTable.symbol, symbol), eq(candlesTable.interval, interval)),
      );
    return {
      checkType: "timestamp_gaps",
      status: "warning",
      candleCount: total[0]?.count ?? 0,
      issueCount: 0,
      details: { description: `Interval "${interval}" not in gap check map — skipped` },
    };
  }

  const rows = await db.execute<{ gap_count: number; candle_count: number }>(
    sql`
      WITH recent AS (
        SELECT timestamp
        FROM candles
        WHERE symbol = ${symbol}
          AND interval = ${interval}
        ORDER BY timestamp DESC
        LIMIT 200
      ),
      gaps AS (
        SELECT COUNT(*) AS gap_count
        FROM (
          SELECT
            timestamp,
            LAG(timestamp) OVER (ORDER BY timestamp) AS prev_ts
          FROM recent
        ) t
        WHERE prev_ts IS NOT NULL
          AND EXTRACT(EPOCH FROM (timestamp - prev_ts)) <> ${expectedGapSec}
      )
      SELECT gap_count::integer, (SELECT COUNT(*)::integer FROM recent) AS candle_count
      FROM gaps
    `,
  );

  const issueCount = (rows.rows[0]?.gap_count as number) ?? 0;
  const candleCount = (rows.rows[0]?.candle_count as number) ?? 0;

  return {
    checkType: "timestamp_gaps",
    status: issueCount === 0 ? "pass" : issueCount < 5 ? "warning" : "fail",
    candleCount,
    issueCount,
    details: {
      description: "Consecutive candles with unexpected time gap",
      expectedGapSeconds: expectedGapSec,
      sampleSize: candleCount,
    },
  };
}

// ---------------------------------------------------------------------------
// Run all checks for a symbol+interval
// ---------------------------------------------------------------------------

export async function runAllChecks(
  symbol: string,
  interval: string,
): Promise<CheckResult[]> {
  const sym = symbol.toUpperCase();

  logger.debug({ symbol: sym, interval }, "Running data quality checks");

  const results = await Promise.all([
    checkOhlcConsistency(sym, interval),
    checkFutureTimestamps(sym, interval),
    checkInvalidVolumes(sym, interval),
    checkDuplicateCandles(sym, interval),
    checkTimestampGaps(sym, interval),
  ]);

  // Persist results to DB
  const now = new Date();
  const inserts: InsertDataQualityCheck[] = results.map((r) => ({
    symbol: sym,
    interval,
    checkType: r.checkType,
    status: r.status,
    candleCount: r.candleCount,
    issueCount: r.issueCount,
    details: JSON.stringify(r.details),
    checkedAt: now,
  }));

  await db.insert(dataQualityChecksTable).values(inserts);

  const failCount = results.filter((r) => r.status === "fail").length;
  const warnCount = results.filter((r) => r.status === "warning").length;

  logger.info(
    { symbol: sym, interval, pass: results.length - failCount - warnCount, warn: warnCount, fail: failCount },
    "Data quality checks complete",
  );

  return results;
}

/**
 * Run all checks for all active crypto markets.
 */
export async function runFullQualityReport(): Promise<void> {
  const markets = await listMarkets({ active: true, type: "crypto" });
  const intervals = ["1h", "1d"];

  logger.info(
    { markets: markets.map((m) => m.symbol), intervals },
    "Starting full data quality report",
  );

  for (const market of markets) {
    for (const interval of intervals) {
      try {
        await runAllChecks(market.symbol, interval);
      } catch (err) {
        logger.error(
          { symbol: market.symbol, interval, err },
          "Data quality check failed",
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export type DataQualityFilters = {
  symbol?: string;
  interval?: string;
  checkType?: string;
  status?: string;
  limit?: number;
};

export async function listDataQualityChecks(
  filters?: DataQualityFilters,
): Promise<DataQualityCheck[]> {
  const conditions = [];

  if (filters?.symbol) {
    conditions.push(eq(dataQualityChecksTable.symbol, filters.symbol.toUpperCase()));
  }
  if (filters?.interval) {
    conditions.push(eq(dataQualityChecksTable.interval, filters.interval));
  }
  if (filters?.checkType) {
    conditions.push(eq(dataQualityChecksTable.checkType, filters.checkType));
  }
  if (filters?.status) {
    conditions.push(eq(dataQualityChecksTable.status, filters.status));
  }

  const limit = Math.min(filters?.limit ?? 50, 200);

  const base = db
    .select()
    .from(dataQualityChecksTable)
    .orderBy(desc(dataQualityChecksTable.checkedAt))
    .limit(limit);

  if (conditions.length > 0) {
    return db
      .select()
      .from(dataQualityChecksTable)
      .where(and(...conditions))
      .orderBy(desc(dataQualityChecksTable.checkedAt))
      .limit(limit);
  }

  return base;
}
