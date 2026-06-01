/**
 * Monte Carlo simulation engine — Phase 4.
 *
 * Takes the completed trades from a backtest and runs N simulations
 * where the trade sequence is randomly shuffled. Each simulation
 * produces a hypothetical total return. We collect the distribution
 * to estimate confidence intervals and probability of ruin.
 *
 * Research-only. No live execution.
 */

import { db } from "@workspace/db";
import { backtestTradesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  createMonteCarloRun,
  updateMonteCarloRun,
} from "./phase4-db";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonteCarloRequest {
  backtestRunId: string;
  simulations?: number;
  seed?: number;
  /** Capital threshold below which we count a simulation as "ruin" (fraction of initial) */
  ruinThreshold?: number;
}

export interface MonteCarloPercentiles {
  p5: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
}

export interface MonteCarloJobResult {
  monteCarloRunId: string;
  status: "completed" | "failed";
  errorMessage?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seeded pseudo-random number generator (mulberry32) for reproducibility */
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(arr: T[], random: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower]!;
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (idx - lower);
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

export async function executeMonteCarloSimulation(
  request: MonteCarloRequest,
): Promise<MonteCarloJobResult> {
  const {
    backtestRunId,
    simulations = 1000,
    seed,
    ruinThreshold = 0.5,
  } = request;

  const mcRun = await createMonteCarloRun(backtestRunId, simulations, seed);
  const mcId = mcRun.id;

  logger.info({ mcId, backtestRunId, simulations }, "Starting Monte Carlo simulation");

  try {
    await updateMonteCarloRun(mcId, { status: "running" });

    // Load all completed trades for the run
    const rawTrades = await db
      .select()
      .from(backtestTradesTable)
      .where(eq(backtestTradesTable.backtestRunId, backtestRunId))
      .orderBy(backtestTradesTable.entryTime);

    if (rawTrades.length === 0) {
      throw new Error(`No trades found for backtest run: ${backtestRunId}`);
    }

    // Extract trade P&L as decimal fractions
    const tradePnlPcts: number[] = rawTrades
      .map((t) => (t.pnlPct !== null ? parseFloat(String(t.pnlPct)) : 0))
      .filter((p) => isFinite(p));

    if (tradePnlPcts.length === 0) {
      throw new Error("No valid P&L data in trades");
    }

    const random = seed !== undefined ? makePrng(seed) : Math.random;
    const finalReturns: number[] = [];
    let ruinCount = 0;

    for (let sim = 0; sim < simulations; sim++) {
      const shuffled = shuffleArray(tradePnlPcts, seed !== undefined ? random : Math.random);

      // Compound the returns through each trade
      let equity = 1.0;
      for (const pnlPct of shuffled) {
        equity *= 1 + pnlPct;
        if (equity < ruinThreshold) {
          ruinCount++;
          break;
        }
      }

      finalReturns.push(equity - 1.0);
    }

    finalReturns.sort((a, b) => a - b);

    const percentiles: MonteCarloPercentiles = {
      p5: percentile(finalReturns, 5),
      p10: percentile(finalReturns, 10),
      p25: percentile(finalReturns, 25),
      p50: percentile(finalReturns, 50),
      p75: percentile(finalReturns, 75),
      p90: percentile(finalReturns, 90),
      p95: percentile(finalReturns, 95),
    };

    const probabilityOfRuin = ruinCount / simulations;
    const worstCaseReturn = finalReturns[0] ?? 0;
    const bestCaseReturn = finalReturns[finalReturns.length - 1] ?? 0;
    const medianReturn = percentile(finalReturns, 50);
    const mean = finalReturns.reduce((a, b) => a + b, 0) / finalReturns.length;
    const variance =
      finalReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / finalReturns.length;
    const returnStdDev = Math.sqrt(variance);

    await updateMonteCarloRun(mcId, {
      status: "completed",
      percentiles: JSON.stringify(percentiles),
      probabilityOfRuin: String(probabilityOfRuin),
      worstCaseReturn: String(worstCaseReturn),
      bestCaseReturn: String(bestCaseReturn),
      medianReturn: String(medianReturn),
      returnStdDev: String(returnStdDev),
      completedAt: new Date(),
    });

    logger.info(
      {
        mcId,
        simulations,
        medianReturn,
        probabilityOfRuin,
        p5: percentiles.p5,
        p95: percentiles.p95,
      },
      "Monte Carlo simulation completed",
    );

    return { monteCarloRunId: mcId, status: "completed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ mcId, err }, "Monte Carlo simulation failed");
    await updateMonteCarloRun(mcId, {
      status: "failed",
      completedAt: new Date(),
    });
    return { monteCarloRunId: mcId, status: "failed", errorMessage: message };
  }
}
