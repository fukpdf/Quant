import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { candlesTable } from "@workspace/db";
import { and, eq, gte } from "drizzle-orm";
import { createCorrelationMatrix, appendAuditLog } from "./risk-db";
import type { CorrelationMatrix } from "@workspace/db";

/**
 * Correlation Engine — Phase 6.
 *
 * Computes Pearson correlation matrices between asset daily returns.
 * Uses closing prices from the candles table.
 *
 * Correlation Risk Score: average absolute off-diagonal coefficient.
 * A score near 1.0 means all assets move together (concentrated risk).
 * A score near 0.0 means assets are uncorrelated (diversified).
 */

/** Primary tradable symbols for correlation tracking */
export const CORRELATION_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

/**
 * Fetch daily closing prices for a symbol over the last N calendar days.
 * Uses the "1d" interval candle data.
 */
async function fetchDailyCloses(
  symbol: string,
  windowDays: number,
): Promise<{ ts: Date; close: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const rows = await db
    .select({
      ts: candlesTable.timestamp,
      close: candlesTable.close,
    })
    .from(candlesTable)
    .where(
      and(
        eq(candlesTable.symbol, symbol),
        eq(candlesTable.interval, "1d"),
        gte(candlesTable.timestamp, since),
      ),
    )
    .orderBy(candlesTable.timestamp);

  return rows.map((r) => ({ ts: r.ts, close: parseFloat(r.close) }));
}

/**
 * Compute daily log-returns from a price series.
 * log(P_t / P_{t-1})
 */
function computeLogReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1]!;
    const curr = closes[i]!;
    if (prev > 0) {
      returns.push(Math.log(curr / prev));
    }
  }
  return returns;
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 */
function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  const meanA = a.slice(0, n).reduce((s, x) => s + x, 0) / n;
  const meanB = b.slice(0, n).reduce((s, x) => s + x, 0) / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;

  for (let i = 0; i < n; i++) {
    const da = a[i]! - meanA;
    const db = b[i]! - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  if (denom === 0) return 0;
  return cov / denom;
}

/**
 * Build and store a correlation matrix for the configured symbols.
 * Returns the stored matrix row.
 */
export async function computeAndStoreCorrelationMatrix(
  windowDays = 30,
): Promise<CorrelationMatrix | null> {
  const symbols = CORRELATION_SYMBOLS;

  // Fetch closes for all symbols in parallel
  const closeArrays = await Promise.all(
    symbols.map((s) => fetchDailyCloses(s, windowDays)),
  );

  // Need at least 2 data points per symbol
  const validSymbols: string[] = [];
  const returnArrays: number[][] = [];

  for (let i = 0; i < symbols.length; i++) {
    const closes = closeArrays[i]!.map((d) => d.close);
    if (closes.length >= 5) {
      validSymbols.push(symbols[i]!);
      returnArrays.push(computeLogReturns(closes));
    }
  }

  if (validSymbols.length < 2) {
    logger.warn(
      { windowDays, available: validSymbols.length },
      "Insufficient data for correlation matrix — skipping",
    );
    return null;
  }

  // Build NxN matrix
  const n = validSymbols.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));

  let offDiagSum = 0;
  let offDiagCount = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i]![j] = 1.0;
      } else {
        const corr = pearsonCorrelation(returnArrays[i]!, returnArrays[j]!);
        matrix[i]![j] = parseFloat(corr.toFixed(4));
        offDiagSum += Math.abs(corr);
        offDiagCount++;
      }
    }
  }

  const correlationRiskScore =
    offDiagCount > 0 ? parseFloat((offDiagSum / offDiagCount).toFixed(4)) : 0;

  const stored = await createCorrelationMatrix({
    symbols: validSymbols,
    matrix,
    windowDays,
    correlationRiskScore: String(correlationRiskScore),
    calculatedAt: new Date(),
  });

  logger.info(
    { symbols: validSymbols, windowDays, correlationRiskScore },
    "Correlation matrix computed and stored",
  );

  await appendAuditLog({
    actor: "scheduler",
    action: "correlation_matrix.compute",
    entityType: "correlation_matrix",
    entityId: stored.id,
    payload: { symbols: validSymbols, windowDays, correlationRiskScore },
    result: "success",
  });

  return stored;
}
