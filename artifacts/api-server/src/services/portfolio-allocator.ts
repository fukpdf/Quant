/**
 * portfolio-allocator.ts — Phase 11 Portfolio Construction & Capital Allocation.
 *
 * Implements five portfolio construction methods:
 *
 *   equal_weight          — 1/N allocation across all strategies
 *   risk_parity           — weights inversely proportional to volatility
 *   volatility_targeting  — scale positions to hit a target portfolio volatility
 *   sharpe_maximization   — mean-variance tangency portfolio (max Sharpe)
 *   kelly                 — fractional Kelly based on individual win rates
 *
 * Advisory only — outputs allocation recommendations that inform human
 * decisions. This module does NOT execute orders or change positions.
 */

import { db } from "@workspace/db";
import {
  backtestRunsTable,
  performanceMetricsTable,
  equityCurvesTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  insertPortfolioAllocation,
  activateAllocation,
  insertAllocationHistory,
  getActiveAllocation,
  listPortfolioAllocations,
  getPortfolioAllocationById,
} from "./intelligence-db";
import type {
  AllocationMethod,
  StrategyProfile,
  AllocationConstraints,
  ComputedAllocation,
} from "./intelligence-types";


// ---------------------------------------------------------------------------
// Data Gathering
// ---------------------------------------------------------------------------

async function gatherStrategyProfiles(strategyNames: string[]): Promise<StrategyProfile[]> {
  const profiles: StrategyProfile[] = [];

  for (const name of strategyNames) {
    const [metrics] = await db
      .select({
        sharpe: sql<string>`avg(cast(${performanceMetricsTable.sharpeRatio} as float))`,
        sortino: sql<string>`avg(cast(${performanceMetricsTable.sortinoRatio} as float))`,
        totalReturn: sql<string>`avg(cast(${performanceMetricsTable.totalReturnPct} as float))`,
        maxDD: sql<string>`avg(cast(${performanceMetricsTable.maxDrawdownPct} as float))`,
        winRate: sql<string>`avg(cast(${performanceMetricsTable.winRate} as float))`,
        avgWin: sql<string>`avg(cast(${performanceMetricsTable.avgWinPct} as float))`,
        avgLoss: sql<string>`avg(cast(${performanceMetricsTable.avgLossPct} as float))`,
        tradeCount: sql<string>`sum(${performanceMetricsTable.totalTrades})`,
      })
      .from(performanceMetricsTable)
      .innerJoin(backtestRunsTable, eq(performanceMetricsTable.backtestRunId, backtestRunsTable.id))
      .where(
        and(
          eq(backtestRunsTable.strategyName, name),
          eq(backtestRunsTable.status, "completed"),
        ),
      );

    if (!metrics?.sharpe) continue;

    // Estimate volatility from equity curve returns
    let volatility = 0.2; // fallback 20%
    const [curve] = await db
      .select()
      .from(equityCurvesTable)
      .innerJoin(backtestRunsTable, eq(equityCurvesTable.backtestRunId, backtestRunsTable.id))
      .where(
        and(
          eq(backtestRunsTable.strategyName, name),
          eq(backtestRunsTable.status, "completed"),
        ),
      )
      .orderBy(sql`${backtestRunsTable.createdAt} desc`)
      .limit(1);

    if (curve) {
      try {
        const curveData = (curve.equity_curves as { curveData?: { e?: number[] } })?.curveData;
        const equity = curveData?.e ?? [];
        if (equity.length > 2) {
          const returns: number[] = [];
          for (let i = 1; i < equity.length; i++) {
            if (equity[i - 1] > 0) returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
          }
          if (returns.length > 0) {
            const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
            volatility = Math.sqrt(variance) * Math.sqrt(252);
          }
        }
      } catch { /* use fallback */ }
    }

    const avgReturn = parseFloat(metrics.totalReturn ?? "0") / 100;

    profiles.push({
      name,
      sharpeRatio: parseFloat(metrics.sharpe ?? "0"),
      sortinoRatio: parseFloat(metrics.sortino ?? "0"),
      totalReturn: parseFloat(metrics.totalReturn ?? "0"),
      maxDrawdown: parseFloat(metrics.maxDD ?? "0"),
      volatility,
      winRate: parseFloat(metrics.winRate ?? "0"),
      avgReturn,
      tradeCount: parseInt(metrics.tradeCount ?? "0"),
    });
  }

  return profiles;
}

// ---------------------------------------------------------------------------
// Allocation Methods
// ---------------------------------------------------------------------------

function clampWeights(
  raw: Record<string, number>,
  constraints: AllocationConstraints,
): Record<string, number> {
  const minW = constraints.minWeight ?? 0.05;
  const maxW = constraints.maxWeight ?? 0.6;
  const clamped: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    clamped[k] = Math.max(minW, Math.min(maxW, v));
  }
  const total = Object.values(clamped).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(clamped)) {
    clamped[k] = clamped[k] / total;
  }
  return clamped;
}

function equalWeight(profiles: StrategyProfile[], constraints: AllocationConstraints): Record<string, number> {
  const n = profiles.length;
  const raw: Record<string, number> = {};
  for (const p of profiles) raw[p.name] = 1 / n;
  return clampWeights(raw, constraints);
}

function riskParity(profiles: StrategyProfile[], constraints: AllocationConstraints): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const p of profiles) {
    raw[p.name] = p.volatility > 0 ? 1 / p.volatility : 1;
  }
  return clampWeights(raw, constraints);
}

function volatilityTargeting(
  profiles: StrategyProfile[],
  constraints: AllocationConstraints,
): Record<string, number> {
  const targetVol = constraints.targetVolatility ?? 0.15;
  const base = riskParity(profiles, { ...constraints, minWeight: 0, maxWeight: 1 });
  const portVol = profiles.reduce((s, p) => s + base[p.name] * p.volatility, 0);
  const scalar = portVol > 0 ? targetVol / portVol : 1;

  const raw: Record<string, number> = {};
  for (const p of profiles) {
    raw[p.name] = (base[p.name] ?? 0) * scalar;
  }
  return clampWeights(raw, constraints);
}

/**
 * Mean-variance tangency portfolio using gradient ascent on Sharpe.
 * Simplified closed-form approximation: weight ∝ E[r] / σ²
 */
function sharpeMaximization(profiles: StrategyProfile[], constraints: AllocationConstraints): Record<string, number> {
  const raw: Record<string, number> = {};
  for (const p of profiles) {
    const vol2 = p.volatility ** 2;
    raw[p.name] = vol2 > 0 ? Math.max(0, p.avgReturn) / vol2 : 0;
  }
  // If all returns are non-positive, fall back to equal weight
  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) return equalWeight(profiles, constraints);
  return clampWeights(raw, constraints);
}

/**
 * Fractional Kelly allocation.
 * f* = (win_rate * avg_win - loss_rate * avg_loss) / avg_win
 * Kelly fraction multiplier applied (default 0.5 = half-Kelly for safety).
 */
function kellyAllocation(profiles: StrategyProfile[], constraints: AllocationConstraints): Record<string, number> {
  const kellyMult = constraints.kellyFraction ?? 0.5;
  const fractions: Record<string, number> = {};
  const raw: Record<string, number> = {};

  for (const p of profiles) {
    const winRate = p.winRate;
    const lossRate = 1 - winRate;
    // Approximate avg_win / avg_loss from Sharpe and vol
    const avgWin = p.sharpeRatio > 0 ? p.volatility * p.sharpeRatio * 0.5 : p.volatility * 0.3;
    const avgLoss = p.volatility * 0.5;
    const kelly = avgLoss > 0 ? (winRate * avgWin - lossRate * avgLoss) / avgWin : 0;
    const f = Math.max(0, kelly * kellyMult);
    fractions[p.name] = parseFloat(f.toFixed(6));
    raw[p.name] = f;
  }

  const total = Object.values(raw).reduce((a, b) => a + b, 0);
  if (total <= 0) return equalWeight(profiles, constraints);

  // Normalize to sum to 1, then clamp
  for (const k of Object.keys(raw)) raw[k] = raw[k] / total;
  const weights = clampWeights(raw, constraints);

  return weights;
}

// ---------------------------------------------------------------------------
// Expected Portfolio Metrics
// ---------------------------------------------------------------------------

function portfolioMetrics(profiles: StrategyProfile[], weights: Record<string, number>) {
  let expectedReturn = 0;
  let expectedVol = 0;
  let expectedDD = 0;

  for (const p of profiles) {
    const w = weights[p.name] ?? 0;
    expectedReturn += w * p.avgReturn;
    expectedVol += w * p.volatility;
    expectedDD += w * Math.abs(p.maxDrawdown);
  }

  const expectedSharpe = expectedVol > 0 ? expectedReturn / expectedVol : 0;
  const diversificationRatio = expectedVol > 0
    ? profiles.reduce((s, p) => s + (weights[p.name] ?? 0) * p.volatility, 0) / expectedVol
    : 1;

  return {
    expectedSharpe: parseFloat(expectedSharpe.toFixed(6)),
    expectedReturn: parseFloat((expectedReturn * 100).toFixed(6)),
    expectedVolatility: parseFloat((expectedVol * 100).toFixed(6)),
    expectedMaxDrawdown: parseFloat(expectedDD.toFixed(6)),
    diversificationRatio: parseFloat(diversificationRatio.toFixed(4)),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function computeAllocation(
  strategyNames: string[],
  method: AllocationMethod,
  constraints: AllocationConstraints = {},
  allocationName?: string,
): Promise<ComputedAllocation> {
  const profiles = await gatherStrategyProfiles(strategyNames);
  if (profiles.length === 0) {
    throw new Error("No strategy profiles found for allocation computation");
  }

  let targetWeights: Record<string, number>;
  const kellyFractions: Record<string, number> = {};

  switch (method) {
    case "equal_weight":
      targetWeights = equalWeight(profiles, constraints);
      break;
    case "risk_parity":
      targetWeights = riskParity(profiles, constraints);
      break;
    case "volatility_targeting":
      targetWeights = volatilityTargeting(profiles, constraints);
      break;
    case "sharpe_maximization":
      targetWeights = sharpeMaximization(profiles, constraints);
      break;
    case "kelly":
      targetWeights = kellyAllocation(profiles, constraints);
      for (const p of profiles) {
        const w = targetWeights[p.name] ?? 0;
        kellyFractions[p.name] = parseFloat((w * (constraints.kellyFraction ?? 0.5)).toFixed(6));
      }
      break;
    default:
      targetWeights = equalWeight(profiles, constraints);
  }

  // Compute risk contributions (simple proportional to weight × vol)
  const riskContributions: Record<string, number> = {};
  const totalRisk = profiles.reduce((s, p) => s + (targetWeights[p.name] ?? 0) * p.volatility, 0);
  for (const p of profiles) {
    riskContributions[p.name] = totalRisk > 0
      ? parseFloat(((targetWeights[p.name] ?? 0) * p.volatility / totalRisk * 100).toFixed(4))
      : 0;
  }

  const mets = portfolioMetrics(profiles, targetWeights);

  // Actual weights = target weights rounded to 4dp (simulate real allocation)
  const actualWeights: Record<string, number> = {};
  for (const [k, v] of Object.entries(targetWeights)) {
    actualWeights[k] = parseFloat(v.toFixed(4));
  }

  return {
    method,
    targetWeights,
    actualWeights,
    kellyFractions,
    riskContributions,
    ...mets,
  };
}

/**
 * Compute and persist a portfolio allocation.
 */
export async function computeAndPersistAllocation(
  strategyNames: string[],
  method: AllocationMethod,
  constraints: AllocationConstraints = {},
  allocationName?: string,
  regimeId?: string,
) {
  const result = await computeAllocation(strategyNames, method, constraints);
  const name = allocationName ?? `${method}-${Date.now()}`;

  const row = await insertPortfolioAllocation({
    allocationName: name,
    method,
    strategyNames: strategyNames as unknown[],
    targetWeights: result.targetWeights as Record<string, unknown>,
    actualWeights: result.actualWeights as Record<string, unknown>,
    kellyFractions: result.kellyFractions as Record<string, unknown>,
    riskContributions: result.riskContributions as Record<string, unknown>,
    constraints: constraints as Record<string, unknown>,
    expectedSharpe: result.expectedSharpe.toString(),
    expectedReturn: result.expectedReturn.toString(),
    expectedVolatility: result.expectedVolatility.toString(),
    expectedMaxDrawdown: result.expectedMaxDrawdown.toString(),
    diversificationRatio: result.diversificationRatio.toString(),
    isActive: false,
    status: "draft",
    regimeId,
    computedAt: new Date(),
  });

  logger.info({ method, strategies: strategyNames.length, allocationId: row.id }, "Allocation computed");
  return row;
}

/**
 * Activate an allocation (archives the current active one).
 */
export async function activatePortfolioAllocation(allocationId: string, reason: string, triggeredBy = "api") {
  const current = await getActiveAllocation();
  const newAlloc = await activateAllocation(allocationId);

  if (current) {
    await insertAllocationHistory({
      allocationId,
      previousWeights: current.actualWeights as Record<string, unknown>,
      newWeights: newAlloc.actualWeights as Record<string, unknown>,
      weightDeltas: computeWeightDeltas(
        current.actualWeights as Record<string, number>,
        newAlloc.actualWeights as Record<string, number>,
      ) as Record<string, unknown>,
      reason,
      triggeredBy,
    });
  }

  return newAlloc;
}

function computeWeightDeltas(prev: Record<string, number>, next: Record<string, number>): Record<string, number> {
  const deltas: Record<string, number> = {};
  const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of allKeys) {
    deltas[k] = parseFloat(((next[k] ?? 0) - (prev[k] ?? 0)).toFixed(4));
  }
  return deltas;
}

export { getActiveAllocation, listPortfolioAllocations, getPortfolioAllocationById };
