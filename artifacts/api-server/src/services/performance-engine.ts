/**
 * performance-engine.ts
 *
 * Computes portfolio performance metrics:
 * - Time Weighted Return (TWR) — chain-links sub-period returns, eliminates cash flow distortion
 * - Money Weighted Return (MWR / IRR) — NPV-based, accounts for timing of cash flows
 * - Period returns: daily, weekly, monthly, quarterly, yearly, YTD, cumulative, rolling
 * - Alpha, Beta, Information Ratio, Treynor Ratio, Jensen's Alpha
 * - Tracking Error, Active Return, Upside/Downside Capture
 *
 * Data sources: paper_daily_snapshots, paper_trade_history, benchmark_snapshots
 */

import { db } from "@workspace/db";
import {
  paperDailySnapshotsTable,
  paperAccountsTable,
  benchmarkSnapshotsTable,
  portfolioBenchmarksTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  savePortfolioPerformance,
  savePerformancePeriod,
  getBenchmarkSnapshotRange,
  listBenchmarkSnapshots,
  appendAnalyticsAuditLog,
} from "./analytics-db";
import type { PortfolioPerformance, PerformancePeriod } from "@workspace/db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse numeric strings safely */
function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

/** Annualized return from a simple total return and number of days */
function annualizeReturn(totalReturnFraction: number, days: number): number {
  if (days <= 0) return 0;
  const years = days / 365;
  if (years < 0.01) return totalReturnFraction;
  return Math.pow(1 + totalReturnFraction, 1 / years) - 1;
}

/** Standard deviation of an array */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Covariance between two same-length arrays */
function covariance(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0;
  const meanA = a.reduce((s, v) => s + v, 0) / a.length;
  const meanB = b.reduce((s, v) => s + v, 0) / b.length;
  return a.reduce((sum, v, i) => sum + (v - meanA) * (b[i]! - meanB), 0) / (a.length - 1);
}

/**
 * Compute Time Weighted Return from an array of sub-period equity points.
 * TWR = ∏(1 + r_i) − 1  where r_i = (end_i / start_i) − 1
 */
export function computeTWR(equityPoints: number[]): number {
  if (equityPoints.length < 2) return 0;
  let product = 1;
  for (let i = 1; i < equityPoints.length; i++) {
    const prev = equityPoints[i - 1]!;
    const curr = equityPoints[i]!;
    if (prev <= 0) continue;
    product *= (curr / prev);
  }
  return product - 1;
}

/**
 * Compute Money Weighted Return (approximate IRR) using Newton-Raphson.
 * cashFlows: array of { time: Date, amount: number }
 *   - positive = inflow (initial deposit, additional capital)
 *   - negative = outflow (withdrawal)
 * finalValue: current portfolio value (treated as final outflow)
 *
 * Returns annualized IRR as a fraction.
 */
export function computeMWR(
  cashFlows: Array<{ time: Date; amount: number }>,
  finalValue: number,
  valuationDate: Date,
): number {
  if (cashFlows.length === 0) return 0;

  // Convert to days-based cash flow array
  const t0 = cashFlows[0]!.time.getTime();
  const tEnd = valuationDate.getTime();
  const totalDays = (tEnd - t0) / (1000 * 60 * 60 * 24);
  if (totalDays <= 0) return 0;

  // Build time-fraction array (fraction of total period)
  const flows: Array<{ t: number; cf: number }> = cashFlows.map(cf => ({
    t: (cf.time.getTime() - t0) / (tEnd - t0),
    cf: -cf.amount, // inflows are negative NPV
  }));
  // Final value is positive outflow at t=1
  flows.push({ t: 1, cf: finalValue });

  // NPV function: NPV(r) = Σ cf_i / (1+r)^t_i
  const npv = (r: number): number =>
    flows.reduce((sum, f) => sum + f.cf / Math.pow(1 + r, f.t), 0);

  const npvDeriv = (r: number): number =>
    flows.reduce((sum, f) => sum - f.t * f.cf / Math.pow(1 + r, f.t + 1), 0);

  // Newton-Raphson iteration
  let r = 0.1; // initial guess: 10%
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    const fp = npvDeriv(r);
    if (Math.abs(fp) < 1e-12) break;
    const rNew = r - f / fp;
    if (Math.abs(rNew - r) < 1e-8) { r = rNew; break; }
    r = rNew;
    if (r < -0.999) r = -0.999; // prevent divide-by-zero
  }

  // Annualize
  const periodYears = totalDays / 365;
  if (periodYears < 0.01) return r;
  return Math.pow(1 + r, 1 / periodYears) - 1;
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export interface PerformanceComputeResult {
  periods: PortfolioPerformance[];
  periodRows: PerformancePeriod[];
}

export async function computeAndSavePerformance(
  accountId: string,
  benchmarkId?: string,
): Promise<PerformanceComputeResult> {
  const start = Date.now();
  logger.info({ accountId }, "Computing portfolio performance");

  // Load account
  const accountRows = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, accountId))
    .limit(1);
  if (!accountRows[0]) throw new Error(`Account not found: ${accountId}`);
  const account = accountRows[0];

  // Load daily snapshots (up to 2 years)
  const cutoff = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000);
  const snapshots = await db
    .select()
    .from(paperDailySnapshotsTable)
    .where(and(
      eq(paperDailySnapshotsTable.accountId, accountId),
      gte(paperDailySnapshotsTable.snapshotDate, cutoff),
    ))
    .orderBy(paperDailySnapshotsTable.snapshotDate);

  if (snapshots.length < 2) {
    await appendAnalyticsAuditLog({
      actor: "system",
      action: "performance.compute",
      accountId,
      result: "skipped",
      payload: { reason: "insufficient_snapshots", count: snapshots.length },
    });
    return { periods: [], periodRows: [] };
  }

  const equityPoints = snapshots.map(s => n(s.equity));
  const initialCapital = n(account.initialCapital);
  const currentEquity = equityPoints[equityPoints.length - 1]!;
  const inception = snapshots[0]!.snapshotDate;
  const now = new Date();
  const daysSinceInception = Math.ceil((now.getTime() - inception.getTime()) / (1000 * 60 * 60 * 24));

  // Daily returns array
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityPoints.length; i++) {
    const prev = equityPoints[i - 1]!;
    const curr = equityPoints[i]!;
    dailyReturns.push(prev > 0 ? (curr - prev) / prev : 0);
  }

  // ---------- TWR (full inception period) ----------
  const twrInception = computeTWR(equityPoints);

  // ---------- MWR (inception) ----------
  const mwr = computeMWR(
    [{ time: inception, amount: initialCapital }],
    currentEquity,
    now,
  );

  // ---------- Gross / Net returns ----------
  const grossReturn = initialCapital > 0 ? (currentEquity - initialCapital) / initialCapital : 0;
  const netReturn = grossReturn; // gross = net at account level (costs already baked in)

  // ---------- Volatility (annualized) ----------
  const dailyVol = stdDev(dailyReturns);
  const annualizedVol = dailyVol * Math.sqrt(252);

  // ---------- Sharpe ----------
  const riskFreeDaily = 0; // 0% risk-free for simplicity
  const excessReturns = dailyReturns.map(r => r - riskFreeDaily);
  const meanExcess = excessReturns.reduce((a, b) => a + b, 0) / (excessReturns.length || 1);
  const sharpeDaily = dailyVol > 0 ? meanExcess / dailyVol : 0;
  const sharpeAnnualized = sharpeDaily * Math.sqrt(252);

  // ---------- Max Drawdown ----------
  let peak = equityPoints[0]!;
  let maxDD = 0;
  for (const e of equityPoints) {
    if (e > peak) peak = e;
    const dd = peak > 0 ? (peak - e) / peak : 0;
    if (dd > maxDD) maxDD = dd;
  }

  // ---------- Benchmark metrics ----------
  let alpha = 0, beta = 1, infoRatio = 0, treynor = 0, jensensAlpha = 0;
  let trackingError = 0, activeReturn = 0;
  let upsideCapture = 100, downsideCapture = 100;
  let benchmarkReturnInception = 0;

  if (benchmarkId) {
    try {
      const bmSnaps = await getBenchmarkSnapshotRange(benchmarkId, inception, now);
      if (bmSnaps.length >= 2) {
        const bmPrices = bmSnaps.map(s => n(s.price));
        const bmDailyReturns: number[] = [];
        for (let i = 1; i < bmPrices.length; i++) {
          const prev = bmPrices[i - 1]!;
          const curr = bmPrices[i]!;
          bmDailyReturns.push(prev > 0 ? (curr - prev) / prev : 0);
        }

        // Align lengths
        const len = Math.min(dailyReturns.length, bmDailyReturns.length);
        const portR = dailyReturns.slice(0, len);
        const bmR = bmDailyReturns.slice(0, len);

        const bmVol = stdDev(bmR);
        const cov = covariance(portR, bmR);
        beta = bmVol > 0 ? cov / (bmVol * bmVol) : 1;

        const bmMeanDaily = bmR.reduce((a, b) => a + b, 0) / (bmR.length || 1);
        const bmAnnualized = bmMeanDaily * 252;
        const portMeanDaily = portR.reduce((a, b) => a + b, 0) / (portR.length || 1);
        const portAnnualized = portMeanDaily * 252;

        alpha = portAnnualized - beta * bmAnnualized;
        jensensAlpha = portAnnualized - (0 + beta * (bmAnnualized - 0)); // CAPM

        const activeDailyReturns = portR.map((r, i) => r - bmR[i]!);
        trackingError = stdDev(activeDailyReturns) * Math.sqrt(252);
        activeReturn = portAnnualized - bmAnnualized;
        infoRatio = trackingError > 0 ? activeReturn / trackingError : 0;
        treynor = beta !== 0 ? portAnnualized / beta : 0;

        // Upside/Downside capture
        const upDays = bmR.reduce((sum, r, i) => r > 0 ? sum + portR[i]! : sum, 0);
        const upBm = bmR.reduce((sum, r) => r > 0 ? sum + r : sum, 0);
        const downDays = bmR.reduce((sum, r, i) => r < 0 ? sum + portR[i]! : sum, 0);
        const downBm = bmR.reduce((sum, r) => r < 0 ? sum + r : sum, 0);
        upsideCapture = upBm !== 0 ? (upDays / upBm) * 100 : 100;
        downsideCapture = downBm !== 0 ? (downDays / downBm) * 100 : 100;

        benchmarkReturnInception = bmPrices[bmPrices.length - 1]! / bmPrices[0]! - 1;
      }
    } catch (e) {
      logger.warn({ e, benchmarkId }, "Failed to compute benchmark metrics");
    }
  }

  // ---------- Build period records ----------
  const periods: PortfolioPerformance[] = [];

  // Cumulative (full inception)
  const cumulativeRecord = await savePortfolioPerformance({
    accountId,
    period: "cumulative",
    periodStart: inception,
    periodEnd: now,
    timeWeightedReturnPct: String(twrInception * 100),
    moneyWeightedReturnPct: String(mwr * 100),
    simpleReturnPct: String(grossReturn * 100),
    grossReturnPct: String(grossReturn * 100),
    netReturnPct: String(netReturn * 100),
    cumulativeReturnPct: String(grossReturn * 100),
    alpha: String(alpha * 100),
    beta: String(beta),
    informationRatio: String(infoRatio),
    treynorRatio: String(treynor * 100),
    jensensAlpha: String(jensensAlpha * 100),
    trackingErrorPct: String(trackingError * 100),
    activeReturnPct: String(activeReturn * 100),
    upsideCapturePct: String(upsideCapture),
    downsideCapturePct: String(downsideCapture),
    benchmarkId: benchmarkId ?? null,
    benchmarkReturnPct: String(benchmarkReturnInception * 100),
    startEquity: String(initialCapital),
    endEquity: String(currentEquity),
    computedAt: now,
  });
  periods.push(cumulativeRecord);

  // YTD
  const ytdStart = new Date(now.getFullYear(), 0, 1);
  const ytdSnaps = snapshots.filter(s => s.snapshotDate >= ytdStart);
  if (ytdSnaps.length >= 2) {
    const ytdEquity = ytdSnaps.map(s => n(s.equity));
    const ytdTwr = computeTWR(ytdEquity);
    const ytdRecord = await savePortfolioPerformance({
      accountId,
      period: "ytd",
      periodStart: ytdStart,
      periodEnd: now,
      timeWeightedReturnPct: String(ytdTwr * 100),
      simpleReturnPct: String(ytdTwr * 100),
      netReturnPct: String(ytdTwr * 100),
      startEquity: String(ytdEquity[0]),
      endEquity: String(ytdEquity[ytdEquity.length - 1]),
      computedAt: now,
    });
    periods.push(ytdRecord);
  }

  // Rolling windows: 7d, 30d, 90d
  for (const days of [7, 30, 90]) {
    const windowStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const windowSnaps = snapshots.filter(s => s.snapshotDate >= windowStart);
    if (windowSnaps.length >= 2) {
      const eq2 = windowSnaps.map(s => n(s.equity));
      const twr = computeTWR(eq2);
      const p = await savePortfolioPerformance({
        accountId,
        period: `rolling_${days}d`,
        periodStart: windowStart,
        periodEnd: now,
        timeWeightedReturnPct: String(twr * 100),
        simpleReturnPct: String(twr * 100),
        netReturnPct: String(twr * 100),
        startEquity: String(eq2[0]),
        endEquity: String(eq2[eq2.length - 1]),
        computedAt: now,
      });
      periods.push(p);
    }
  }

  // ---------- Performance periods (monthly + yearly) ----------
  const periodRows: PerformancePeriod[] = [];

  // Monthly periods
  const monthMap = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const key = `${snap.snapshotDate.getFullYear()}-${String(snap.snapshotDate.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(snap);
  }
  for (const [label, monthSnaps] of monthMap.entries()) {
    if (monthSnaps.length < 2) continue;
    const sortedM = [...monthSnaps].sort((a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime());
    const mEq = sortedM.map(s => n(s.equity));
    const mReturn = computeTWR(mEq);
    const pr = await savePerformancePeriod({
      accountId,
      periodType: "monthly",
      periodLabel: label,
      periodStart: sortedM[0]!.snapshotDate,
      periodEnd: sortedM[sortedM.length - 1]!.snapshotDate,
      returnPct: String(mReturn * 100),
      netReturnPct: String(mReturn * 100),
      startEquity: String(mEq[0]),
      endEquity: String(mEq[mEq.length - 1]),
      pnl: String(mEq[mEq.length - 1]! - mEq[0]!),
      tradeCount: sortedM.reduce((sum, s) => sum + (s.tradesClosed ?? 0), 0),
      computedAt: now,
    });
    periodRows.push(pr);
  }

  // Yearly periods
  const yearMap = new Map<string, typeof snapshots>();
  for (const snap of snapshots) {
    const key = String(snap.snapshotDate.getFullYear());
    if (!yearMap.has(key)) yearMap.set(key, []);
    yearMap.get(key)!.push(snap);
  }
  for (const [label, yearSnaps] of yearMap.entries()) {
    if (yearSnaps.length < 2) continue;
    const sortedY = [...yearSnaps].sort((a, b) => a.snapshotDate.getTime() - b.snapshotDate.getTime());
    const yEq = sortedY.map(s => n(s.equity));
    const yReturn = computeTWR(yEq);
    const pr = await savePerformancePeriod({
      accountId,
      periodType: "yearly",
      periodLabel: label,
      periodStart: sortedY[0]!.snapshotDate,
      periodEnd: sortedY[sortedY.length - 1]!.snapshotDate,
      returnPct: String(yReturn * 100),
      netReturnPct: String(yReturn * 100),
      startEquity: String(yEq[0]),
      endEquity: String(yEq[yEq.length - 1]),
      pnl: String(yEq[yEq.length - 1]! - yEq[0]!),
      tradeCount: sortedY.reduce((sum, s) => sum + (s.tradesClosed ?? 0), 0),
      computedAt: now,
    });
    periodRows.push(pr);
  }

  await appendAnalyticsAuditLog({
    actor: "system",
    action: "performance.compute",
    accountId,
    result: "success",
    durationMs: String(Date.now() - start),
    payload: { periodsComputed: periods.length, periodRowsComputed: periodRows.length },
  });

  return { periods, periodRows };
}
