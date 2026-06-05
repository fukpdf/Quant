/**
 * diversification-engine.ts
 *
 * Diversification Analytics Engine.
 * Computes:
 * - Diversification score (0–100)
 * - HHI concentration index
 * - Effective N (independent bets)
 * - Correlation exposure
 * - Asset / strategy concentration
 * - Portfolio balance score
 */

import { db } from "@workspace/db";
import {
  paperPositionsTable,
  paperStrategyAssignmentsTable,
  paperAccountsTable,
  correlationMatricesTable,
} from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { appendAnalyticsAuditLog } from "./analytics-db";
import { logger } from "../lib/logger";

function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, v));
}

export interface DiversificationAnalysis {
  accountId: string;
  computedAt: Date;
  overallDiversificationScore: number;
  hhi: number;
  effectiveN: number;
  portfolioBalanceScore: number;
  concentrationRisk: {
    largestPositionPct: number;
    largestPositionSymbol: string;
    top3ConcentrationPct: number;
    isConcentrated: boolean;
    concentrationWarning: string | null;
  };
  assetConcentration: Array<{
    symbol: string;
    allocationPct: number;
    positionCount: number;
  }>;
  strategyConcentration: Array<{
    strategyName: string;
    allocationPct: number;
    positionCount: number;
  }>;
  correlationExposure: {
    avgPairwiseCorrelation: number | null;
    maxCorrelation: number | null;
    correlationRisk: string;
    availableAt: Date | null;
  };
}

export async function computeDiversificationAnalysis(accountId: string): Promise<DiversificationAnalysis> {
  const startMs = Date.now();
  logger.info({ accountId }, "Computing diversification analysis");

  const accountRows = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, accountId))
    .limit(1);
  if (!accountRows[0]) throw new Error(`Account not found: ${accountId}`);

  const equity = n(accountRows[0].currentEquity);

  // Open positions
  const positions = await db
    .select()
    .from(paperPositionsTable)
    .where(and(
      eq(paperPositionsTable.accountId, accountId),
      eq(paperPositionsTable.status, "open"),
    ));

  // Active strategy assignments
  const assignments = await db
    .select()
    .from(paperStrategyAssignmentsTable)
    .where(and(
      eq(paperStrategyAssignmentsTable.accountId, accountId),
      eq(paperStrategyAssignmentsTable.status, "active"),
    ));

  // ---- Asset concentration ----
  const assetMap = new Map<string, { value: number; count: number }>();
  for (const p of positions) {
    const mv = n(p.marketValue);
    const sym = p.symbol;
    const existing = assetMap.get(sym) ?? { value: 0, count: 0 };
    assetMap.set(sym, { value: existing.value + mv, count: existing.count + 1 });
  }

  const totalInvested = [...assetMap.values()].reduce((s, v) => s + v.value, 0);
  const base = Math.max(equity, totalInvested, 1);

  const assetConcentration = [...assetMap.entries()]
    .map(([symbol, { value, count }]) => ({
      symbol,
      allocationPct: (value / base) * 100,
      positionCount: count,
    }))
    .sort((a, b) => b.allocationPct - a.allocationPct);

  // ---- HHI ----
  const weights = assetConcentration.map(a => a.allocationPct / 100);
  const hhi = weights.reduce((s, w) => s + w * w, 0) * 10000;
  const effectiveN = hhi > 0 ? 10000 / hhi : 1;

  // ---- Strategy concentration ----
  const stratMap = new Map<string, { positions: number }>();
  for (const p of positions) {
    const strat = p.strategyName ?? "manual";
    const existing = stratMap.get(strat) ?? { positions: 0 };
    stratMap.set(strat, { positions: existing.positions + 1 });
  }
  const strategyConcentration = [...stratMap.entries()]
    .map(([strategyName, { positions: posCount }]) => ({
      strategyName,
      allocationPct: positions.length > 0 ? (posCount / positions.length) * 100 : 0,
      positionCount: posCount,
    }))
    .sort((a, b) => b.allocationPct - a.allocationPct);

  // ---- Largest position ----
  const largestPos = assetConcentration[0] ?? { symbol: "none", allocationPct: 0 };
  const top3Pct = assetConcentration.slice(0, 3).reduce((s, a) => s + a.allocationPct, 0);
  const isConcentrated = largestPos.allocationPct > 40 || top3Pct > 80;
  const concentrationWarning = largestPos.allocationPct > 50
    ? `${largestPos.symbol} represents ${largestPos.allocationPct.toFixed(1)}% of portfolio — high concentration risk`
    : top3Pct > 80
    ? `Top 3 assets represent ${top3Pct.toFixed(1)}% of portfolio`
    : null;

  // ---- Correlation exposure ----
  let avgCorr: number | null = null;
  let maxCorr: number | null = null;
  let corrAvailableAt: Date | null = null;
  const corrRows = await db
    .select()
    .from(correlationMatricesTable)
    .orderBy(desc(correlationMatricesTable.calculatedAt))
    .limit(1);
  if (corrRows[0]) {
    const matrix = corrRows[0].matrix as Record<string, Record<string, number>> | null;
    corrAvailableAt = corrRows[0].calculatedAt;
    if (matrix) {
      const symbols = Object.keys(matrix);
      const pairCorrs: number[] = [];
      for (let i = 0; i < symbols.length; i++) {
        for (let j = i + 1; j < symbols.length; j++) {
          const c = matrix[symbols[i]!]?.[symbols[j]!];
          if (typeof c === "number") pairCorrs.push(Math.abs(c));
        }
      }
      if (pairCorrs.length > 0) {
        avgCorr = pairCorrs.reduce((a, b) => a + b, 0) / pairCorrs.length;
        maxCorr = Math.max(...pairCorrs);
      }
    }
  }

  const correlationRisk =
    maxCorr == null ? "unknown" :
    maxCorr > 0.8 ? "high" :
    maxCorr > 0.5 ? "medium" : "low";

  // ---- Scoring ----
  const hhiScore = clamp(100 - (hhi / 10000) * 100);
  const effectiveNScore = clamp(Math.min(effectiveN, 10) * 10);
  const concentrationScore = clamp(100 - largestPos.allocationPct);
  const stratDiversScore = clamp(Math.min(stratMap.size, 5) * 20);
  const corrScore = avgCorr == null ? 50 : clamp((1 - avgCorr) * 100);

  const overallDiversificationScore = clamp(
    hhiScore * 0.3 +
    effectiveNScore * 0.2 +
    concentrationScore * 0.2 +
    stratDiversScore * 0.15 +
    corrScore * 0.15,
  );

  const portfolioBalanceScore = clamp(
    (assetConcentration.length > 0 ? hhiScore : 0) * 0.5 +
    stratDiversScore * 0.3 +
    clamp(Math.min(positions.length, 10) * 10) * 0.2,
  );

  await appendAnalyticsAuditLog({
    actor: "system",
    action: "diversification.compute",
    accountId,
    result: "success",
    durationMs: String(Date.now() - startMs),
    payload: { overallDiversificationScore, hhi, effectiveN },
  });

  return {
    accountId,
    computedAt: new Date(),
    overallDiversificationScore,
    hhi,
    effectiveN,
    portfolioBalanceScore,
    concentrationRisk: {
      largestPositionPct: largestPos.allocationPct,
      largestPositionSymbol: largestPos.symbol,
      top3ConcentrationPct: top3Pct,
      isConcentrated,
      concentrationWarning,
    },
    assetConcentration,
    strategyConcentration,
    correlationExposure: {
      avgPairwiseCorrelation: avgCorr,
      maxCorrelation: maxCorr,
      correlationRisk,
      availableAt: corrAvailableAt,
    },
  };
}
