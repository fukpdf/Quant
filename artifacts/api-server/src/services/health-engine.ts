/**
 * health-engine.ts
 *
 * Portfolio Health Scoring Engine.
 * Generates scores (0–100) across 5 dimensions and an overall grade (A–F).
 *
 * Dimensions:
 *   - Performance Score: based on Sharpe, return vs benchmark, win rate
 *   - Risk Score: based on max drawdown, volatility, risk-adjusted return
 *   - Diversification Score: based on asset count, HHI, strategy count
 *   - Consistency Score: based on return volatility across periods
 *   - Capital Efficiency Score: based on capital deployment, return per unit deployed
 *
 * Grading:
 *   90-100 = A
 *   75-89  = B
 *   60-74  = C
 *   45-59  = D
 *   0-44   = F
 */

import { db } from "@workspace/db";
import {
  paperAccountsTable,
  paperPositionsTable,
  paperTradeHistoryTable,
  paperDailySnapshotsTable,
  paperStrategyAssignmentsTable,
} from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import {
  saveHealthScore,
  getLatestAllocationSnapshot,
  appendAnalyticsAuditLog,
} from "./analytics-db";
import { logger } from "../lib/logger";
import type { PortfolioHealthScore } from "@workspace/db";

function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 45) return "D";
  return "F";
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export async function computeAndSaveHealthScore(accountId: string): Promise<PortfolioHealthScore> {
  const startMs = Date.now();
  logger.info({ accountId }, "Computing health score");

  // ----- Load data -----
  const accountRows = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, accountId))
    .limit(1);
  if (!accountRows[0]) throw new Error(`Account not found: ${accountId}`);
  const account = accountRows[0];

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  const [rawSnaps, trades, positions, assignments, allocSnap] = await Promise.all([
    db.select().from(paperDailySnapshotsTable)
      .where(and(
        eq(paperDailySnapshotsTable.accountId, accountId),
        gte(paperDailySnapshotsTable.snapshotDate, cutoff.toISOString().split('T')[0]!),
      ))
      .orderBy(paperDailySnapshotsTable.snapshotDate),
    db.select().from(paperTradeHistoryTable)
      .where(eq(paperTradeHistoryTable.accountId, accountId)),
    db.select().from(paperPositionsTable)
      .where(and(
        eq(paperPositionsTable.accountId, accountId),
        eq(paperPositionsTable.status, "open"),
      )),
    db.select().from(paperStrategyAssignmentsTable)
      .where(and(
        eq(paperStrategyAssignmentsTable.accountId, accountId),
        eq(paperStrategyAssignmentsTable.status, "active"),
      )),
    getLatestAllocationSnapshot(accountId),
  ]);

  const snapshots = rawSnaps.map(s => ({ ...s, snapshotDate: new Date(s.snapshotDate) }));
  const equityPoints = snapshots.map(s => n(s.equity));
  const initialCapital = n(account.initialCapital);
  const currentEquity = n(account.currentEquity);
  const totalTrades = trades.length;

  // ----- Performance Score (0-100) -----
  let performanceScore = 50; // base
  const details: Record<string, unknown> = {};

  if (equityPoints.length >= 2) {
    // Daily returns
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityPoints.length; i++) {
      const prev = equityPoints[i - 1]!;
      const curr = equityPoints[i]!;
      dailyReturns.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    const dailyVol = stdDev(dailyReturns);
    const meanDaily = dailyReturns.reduce((a, b) => a + b, 0) / (dailyReturns.length || 1);
    const sharpe = dailyVol > 0 ? (meanDaily / dailyVol) * Math.sqrt(252) : 0;
    const totalReturn = initialCapital > 0 ? (currentEquity - initialCapital) / initialCapital : 0;

    // Win rate
    const winRate = totalTrades > 0 ? trades.filter(t => n(t.netPnl) > 0).length / totalTrades : 0;

    // Score components
    const sharpeScore = clamp(50 + sharpe * 15, 0, 100);
    const returnScore = clamp(50 + totalReturn * 200, 0, 100);
    const winRateScore = clamp(winRate * 100, 0, 100);

    performanceScore = clamp((sharpeScore * 0.4 + returnScore * 0.35 + winRateScore * 0.25));
    details["performance"] = { sharpe, totalReturn: totalReturn * 100, winRate: winRate * 100, sharpeScore, returnScore, winRateScore };
  }

  // ----- Risk Score (0-100) — higher = less risk -----
  let riskScore = 60;

  if (equityPoints.length >= 2) {
    let peak = equityPoints[0]!;
    let maxDD = 0;
    for (const e of equityPoints) {
      if (e > peak) peak = e;
      const dd = peak > 0 ? (peak - e) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityPoints.length; i++) {
      const prev = equityPoints[i - 1]!;
      const curr = equityPoints[i]!;
      dailyReturns.push(prev > 0 ? (curr - prev) / prev : 0);
    }
    const vol = stdDev(dailyReturns) * Math.sqrt(252);

    // Lower drawdown = higher score
    const ddScore = clamp(100 - maxDD * 400); // 25% DD → 0
    // Lower volatility = higher score
    const volScore = clamp(100 - vol * 200); // 50% annual vol → 0
    riskScore = clamp(ddScore * 0.6 + volScore * 0.4);
    details["risk"] = { maxDrawdown: maxDD * 100, annualizedVolatility: vol * 100, ddScore, volScore };
  }

  // ----- Diversification Score (0-100) -----
  let diversificationScore = 50;

  const uniqueAssets = new Set(positions.map(p => p.symbol)).size;
  const uniqueStrategies = new Set(assignments.map(a => a.strategyName)).size;

  let hhi = 10000; // worst case: 1 asset = 100% = HHI 10000
  if (allocSnap?.hhi) hhi = n(allocSnap.hhi);

  const assetScore = clamp(Math.min(uniqueAssets, 10) * 10); // 10+ assets = 100
  const stratScore = clamp(Math.min(uniqueStrategies, 5) * 20); // 5+ strategies = 100
  const hhiScore = clamp(100 - (hhi / 10000) * 100); // lower HHI = better
  diversificationScore = clamp(assetScore * 0.4 + stratScore * 0.3 + hhiScore * 0.3);
  details["diversification"] = { uniqueAssets, uniqueStrategies, hhi, assetScore, stratScore, hhiScore };

  // ----- Consistency Score (0-100) -----
  let consistencyScore = 50;

  if (snapshots.length >= 10) {
    // Monthly return consistency
    const monthlyReturns: number[] = [];
    const monthMap = new Map<string, number[]>();
    for (const s of snapshots) {
      const key = `${new Date(s.snapshotDate).getFullYear()}-${new Date(s.snapshotDate).getMonth()}`;
      if (!monthMap.has(key)) monthMap.set(key, []);
      monthMap.get(key)!.push(n(s.equity));
    }
    for (const eqs of monthMap.values()) {
      if (eqs.length >= 2) {
        monthlyReturns.push((eqs[eqs.length - 1]! - eqs[0]!) / eqs[0]!);
      }
    }

    if (monthlyReturns.length >= 2) {
      const positiveMonths = monthlyReturns.filter(r => r > 0).length;
      const positiveRatio = positiveMonths / monthlyReturns.length;
      const retVol = stdDev(monthlyReturns);

      const positiveScore = clamp(positiveRatio * 100);
      const volPenalty = clamp(100 - retVol * 1000); // lower monthly vol = better
      consistencyScore = clamp(positiveScore * 0.6 + volPenalty * 0.4);
      details["consistency"] = { positiveMonths, totalMonths: monthlyReturns.length, positiveRatio: positiveRatio * 100, monthlyVolatility: retVol * 100 };
    }
  }

  // ----- Capital Efficiency Score (0-100) -----
  let capitalEfficiencyScore = 50;

  const deployedPct = allocSnap ? (100 - n(allocSnap.cashAllocationPct)) : 0;
  const totalReturn = initialCapital > 0 ? (currentEquity - initialCapital) / initialCapital : 0;

  // Return per unit deployed
  const returnPerDeployed = deployedPct > 0 ? (totalReturn * 100) / deployedPct : 0;
  const deploymentScore = clamp(deployedPct); // 100% deployed = 100
  const returnEffScore = clamp(50 + returnPerDeployed * 10);
  capitalEfficiencyScore = clamp(deploymentScore * 0.5 + returnEffScore * 0.5);
  details["capitalEfficiency"] = { deployedPct, totalReturn: totalReturn * 100, returnPerDeployed };

  // ----- Overall Score -----
  const overallScore = clamp(
    performanceScore * 0.3 +
    riskScore * 0.25 +
    diversificationScore * 0.2 +
    consistencyScore * 0.15 +
    capitalEfficiencyScore * 0.1,
  );
  const grade = scoreToGrade(overallScore);

  const healthScore = await saveHealthScore({
    accountId,
    scoredAt: new Date(),
    performanceScore: String(performanceScore),
    riskScore: String(riskScore),
    diversificationScore: String(diversificationScore),
    consistencyScore: String(consistencyScore),
    capitalEfficiencyScore: String(capitalEfficiencyScore),
    overallScore: String(overallScore),
    grade,
    details: {
      ...details,
      weights: { performance: 0.30, risk: 0.25, diversification: 0.20, consistency: 0.15, capitalEfficiency: 0.10 },
    },
  });

  await appendAnalyticsAuditLog({
    actor: "system",
    action: "health.score",
    accountId,
    entityType: "health",
    entityId: healthScore.id,
    result: "success",
    durationMs: String(Date.now() - startMs),
    payload: { overallScore, grade },
  });

  logger.info({ accountId, overallScore, grade }, "Health score computed");
  return healthScore;
}
