/**
 * strategy-optimizer.ts — Phase 11 Strategy Parameter Optimizer.
 *
 * Supports four optimization methods:
 *
 *   grid_search   — exhaustive evaluation of all parameter combinations
 *   random_search — Monte Carlo sampling of the parameter space
 *   bayesian      — Gaussian process surrogate with expected improvement
 *   genetic       — genetic algorithm (delegates to GeneticEvolutionEngine)
 *
 * Each run is persisted as an optimization_run with full result history.
 * The best parameter set and its performance metrics are recorded on the run.
 *
 * Advisory only — optimizes backtest parameters, not live capital.
 */

import { logger } from "../lib/logger";
import {
  insertOptimizationRun,
  updateOptimizationRun,
  insertOptimizationResult,
  markResultAsBest,
  listOptimizationRuns,
  getOptimizationRunById,
  listOptimizationResults,
} from "./intelligence-db";
import { runGeneticEvolution } from "./genetic-evolution-engine";
import { insertStrategyLineage } from "./intelligence-db";
import type { OptimizationConfig, ParameterSpace, OptimizationTrialResult } from "./intelligence-types";


// ---------------------------------------------------------------------------
// Parameter Space Sampling Utilities
// ---------------------------------------------------------------------------

function gridPoints(space: ParameterSpace): Record<string, number>[] {
  const keys = Object.keys(space);
  const valueSets: number[][] = keys.map((k) => {
    const r = space[k];
    if (r.values) return r.values as number[];
    const points: number[] = [];
    const step = r.step ?? (r.type === "int" ? 1 : (r.max - r.min) / 5);
    for (let v = r.min; v <= r.max + 1e-9; v += step) {
      const snapped = r.type === "int" ? Math.round(v) : parseFloat(v.toFixed(4));
      points.push(snapped);
    }
    return [...new Set(points)];
  });

  // Cartesian product
  let combinations: Record<string, number>[] = [{}];
  for (let ki = 0; ki < keys.length; ki++) {
    const newCombos: Record<string, number>[] = [];
    for (const combo of combinations) {
      for (const v of valueSets[ki]) {
        newCombos.push({ ...combo, [keys[ki]]: v });
      }
    }
    combinations = newCombos;
    if (combinations.length > 10000) break; // Safety cap
  }
  return combinations;
}

function randomSample(space: ParameterSpace): Record<string, number> {
  const params: Record<string, number> = {};
  for (const [k, r] of Object.entries(space)) {
    if (r.values && r.values.length > 0) {
      params[k] = r.values[Math.floor(Math.random() * r.values.length)] as number;
    } else {
      const v = r.min + Math.random() * (r.max - r.min);
      params[k] = r.type === "int" ? Math.round(v) : parseFloat(v.toFixed(4));
    }
  }
  return params;
}

// ---------------------------------------------------------------------------
// Bayesian Optimization (Gaussian Process Surrogate)
// ---------------------------------------------------------------------------

/**
 * Simplified Bayesian optimization using expected improvement acquisition.
 * Fits a linear surrogate on observed (params → score) pairs, then samples
 * N candidates and picks the one with highest expected improvement.
 *
 * A proper GP would be used in production; this approximation is appropriate
 * for research exploration at low iteration counts (< 200).
 */
function expectedImprovement(
  candidate: number[],
  observations: Array<{ x: number[]; y: number }>,
  bestY: number,
  noiseLevel = 0.01,
): number {
  if (observations.length === 0) return 1;
  // Naive RBF kernel mean estimation
  let weightedSum = 0;
  let weightSum = 0;
  for (const obs of observations) {
    const dist = Math.sqrt(
      obs.x.reduce((s, v, i) => s + (v - candidate[i]) ** 2, 0),
    );
    const w = Math.exp(-dist / (noiseLevel + 0.1));
    weightedSum += w * obs.y;
    weightSum += w;
  }
  const predictedMean = weightSum > 0 ? weightedSum / weightSum : 0;
  const improvement = predictedMean - bestY;
  return Math.max(0, improvement);
}

function paramsToVector(params: Record<string, number>, keys: string[]): number[] {
  return keys.map((k) => params[k]);
}

// ---------------------------------------------------------------------------
// Backtest Evaluation Wrapper
// ---------------------------------------------------------------------------

async function evaluateParameters(
  params: Record<string, number>,
  config: OptimizationConfig,
): Promise<OptimizationTrialResult> {
  const start = Date.now();
  try {
    const { executeBacktest } = await import("./research-runner");
    const { db: _db } = await import("@workspace/db");
    const { performanceMetricsTable: _pmt } = await import("@workspace/db/schema");
    const { eq: _eq } = await import("drizzle-orm");

    const result = await executeBacktest({
      strategyName: config.strategyName,
      params: params as Partial<import("../strategies/types").StrategyParams>,
      symbol: config.symbol,
      interval: config.timeframe,
      startDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
      initialCapital: 10000,
    });

    const [m] = result.runId
      ? await _db.select().from(_pmt).where(_eq(_pmt.backtestRunId, result.runId)).limit(1)
      : [];

    const sharpe = parseFloat(m?.sharpeRatio ?? "0");
    const sortino = parseFloat(m?.sortinoRatio ?? String(sharpe));
    const totalReturn = parseFloat(m?.totalReturnPct ?? "0");
    const maxDD = parseFloat(m?.maxDrawdownPct ?? "0");
    const winRate = parseFloat(m?.winRate ?? "0");
    const tradeCount = m?.totalTrades ?? 0;
    const profitFactor = parseFloat(m?.profitFactor ?? "1");

    let score: number;
    switch (config.objective) {
      case "sharpe": score = sharpe; break;
      case "calmar": score = Math.abs(maxDD) > 0 ? totalReturn / Math.abs(maxDD) : 0; break;
      case "total_return": score = totalReturn; break;
      case "sortino": score = sortino; break;
      case "profit_factor": score = profitFactor; break;
      default: score = sharpe;
    }

    return {
      parameters: params,
      score: isFinite(score) ? score : 0,
      sharpeRatio: isFinite(sharpe) ? sharpe : 0,
      sortinoRatio: isFinite(sortino) ? sortino : 0,
      totalReturn: isFinite(totalReturn) ? totalReturn : 0,
      maxDrawdown: isFinite(maxDD) ? maxDD : 0,
      winRate: isFinite(winRate) ? winRate : 0,
      tradeCount,
      profitFactor: isFinite(profitFactor) ? profitFactor : 0,
      evaluationMs: Date.now() - start,
    };
  } catch (err) {
    logger.warn({ err, params }, "Trial evaluation failed");
    return {
      parameters: params,
      score: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      totalReturn: 0,
      maxDrawdown: 0,
      winRate: 0,
      tradeCount: 0,
      profitFactor: 0,
      evaluationMs: Date.now() - start,
    };
  }
}

// ---------------------------------------------------------------------------
// Main Optimization Runners
// ---------------------------------------------------------------------------

async function runGridSearch(config: OptimizationConfig, runId: string) {
  const paramCombinations = gridPoints(config.parameterSpace);
  const maxIter = config.maxIterations ?? paramCombinations.length;
  const toEvaluate = paramCombinations.slice(0, maxIter);

  await updateOptimizationRun(runId, {
    status: "running",
    startedAt: new Date(),
  });

  let bestResult: OptimizationTrialResult | null = null;
  let bestResultId: string | null = null;

  for (let i = 0; i < toEvaluate.length; i++) {
    const trial = await evaluateParameters(toEvaluate[i], config);
    const isBest = !bestResult || trial.score > bestResult.score;

    const [row] = await insertOptimizationResult({
      runId,
      iterationNumber: i + 1,
      parameters: trial.parameters as Record<string, unknown>,
      score: trial.score.toString(),
      sharpeRatio: trial.sharpeRatio.toString(),
      sortinoRatio: trial.sortinoRatio.toString(),
      totalReturn: trial.totalReturn.toString(),
      maxDrawdown: trial.maxDrawdown.toString(),
      winRate: trial.winRate.toString(),
      tradeCount: trial.tradeCount,
      profitFactor: trial.profitFactor.toString(),
      isBest,
      evaluationMs: trial.evaluationMs.toString(),
    }) as unknown as [Awaited<ReturnType<typeof insertOptimizationResult>>];

    if (isBest) {
      if (bestResultId) await markResultAsBest(runId, ""); // un-mark previous
      bestResult = trial;
      bestResultId = row?.id;
      await updateOptimizationRun(runId, {
        bestScore: trial.score.toString(),
        bestParameters: trial.parameters as Record<string, unknown>,
        bestSharpe: trial.sharpeRatio.toString(),
        bestTotalReturn: trial.totalReturn.toString(),
        bestMaxDrawdown: trial.maxDrawdown.toString(),
        completedIterations: i + 1,
      });
    }

    if ((i + 1) % 10 === 0) {
      await updateOptimizationRun(runId, { completedIterations: i + 1 });
    }
  }

  return bestResult;
}

async function runRandomSearch(config: OptimizationConfig, runId: string) {
  const maxIter = config.maxIterations ?? 100;

  await updateOptimizationRun(runId, { status: "running", startedAt: new Date() });

  let bestResult: OptimizationTrialResult | null = null;

  for (let i = 0; i < maxIter; i++) {
    const params = randomSample(config.parameterSpace);
    const trial = await evaluateParameters(params, config);
    const isBest = !bestResult || trial.score > bestResult.score;

    await insertOptimizationResult({
      runId,
      iterationNumber: i + 1,
      parameters: trial.parameters as Record<string, unknown>,
      score: trial.score.toString(),
      sharpeRatio: trial.sharpeRatio.toString(),
      sortinoRatio: trial.sortinoRatio.toString(),
      totalReturn: trial.totalReturn.toString(),
      maxDrawdown: trial.maxDrawdown.toString(),
      winRate: trial.winRate.toString(),
      tradeCount: trial.tradeCount,
      profitFactor: trial.profitFactor.toString(),
      isBest,
      evaluationMs: trial.evaluationMs.toString(),
    });

    if (isBest) {
      bestResult = trial;
      await updateOptimizationRun(runId, {
        bestScore: trial.score.toString(),
        bestParameters: trial.parameters as Record<string, unknown>,
        bestSharpe: trial.sharpeRatio.toString(),
        bestTotalReturn: trial.totalReturn.toString(),
        bestMaxDrawdown: trial.maxDrawdown.toString(),
        completedIterations: i + 1,
      });
    }
  }

  return bestResult;
}

async function runBayesianSearch(config: OptimizationConfig, runId: string) {
  const explorationTrials = config.explorationTrials ?? 15;
  const totalTrials = config.maxIterations ?? 50;
  const keys = Object.keys(config.parameterSpace);

  await updateOptimizationRun(runId, { status: "running", startedAt: new Date() });

  const observations: Array<{ x: number[]; y: number; params: Record<string, number> }> = [];
  let bestResult: OptimizationTrialResult | null = null;
  let iteration = 0;

  // Exploration phase
  for (let i = 0; i < explorationTrials && iteration < totalTrials; i++, iteration++) {
    const params = randomSample(config.parameterSpace);
    const trial = await evaluateParameters(params, config);
    observations.push({ x: paramsToVector(params, keys), y: trial.score, params });

    const isBest = !bestResult || trial.score > bestResult.score;
    if (isBest) bestResult = trial;

    await insertOptimizationResult({
      runId,
      iterationNumber: iteration + 1,
      parameters: trial.parameters as Record<string, unknown>,
      score: trial.score.toString(),
      sharpeRatio: trial.sharpeRatio.toString(),
      sortinoRatio: trial.sortinoRatio.toString(),
      totalReturn: trial.totalReturn.toString(),
      maxDrawdown: trial.maxDrawdown.toString(),
      winRate: trial.winRate.toString(),
      tradeCount: trial.tradeCount,
      isBest,
      evaluationMs: trial.evaluationMs.toString(),
    });
  }

  // Exploitation phase using EI acquisition
  while (iteration < totalTrials) {
    const bestY = bestResult?.score ?? 0;
    const candidates = Array.from({ length: 50 }, () => randomSample(config.parameterSpace));
    const selected = candidates.reduce((best, c) => {
      const ei = expectedImprovement(paramsToVector(c, keys), observations, bestY);
      const bestEi = expectedImprovement(paramsToVector(best, keys), observations, bestY);
      return ei > bestEi ? c : best;
    });

    const trial = await evaluateParameters(selected, config);
    observations.push({ x: paramsToVector(selected, keys), y: trial.score, params: selected });

    const isBest = !bestResult || trial.score > bestResult.score;
    if (isBest) {
      bestResult = trial;
      await updateOptimizationRun(runId, {
        bestScore: trial.score.toString(),
        bestParameters: trial.parameters as Record<string, unknown>,
        bestSharpe: trial.sharpeRatio.toString(),
        bestTotalReturn: trial.totalReturn.toString(),
        bestMaxDrawdown: trial.maxDrawdown.toString(),
        completedIterations: iteration + 1,
      });
    }

    const ei = expectedImprovement(paramsToVector(selected, keys), observations, bestY);
    await insertOptimizationResult({
      runId,
      iterationNumber: iteration + 1,
      parameters: trial.parameters as Record<string, unknown>,
      score: trial.score.toString(),
      sharpeRatio: trial.sharpeRatio.toString(),
      sortinoRatio: trial.sortinoRatio.toString(),
      totalReturn: trial.totalReturn.toString(),
      maxDrawdown: trial.maxDrawdown.toString(),
      winRate: trial.winRate.toString(),
      tradeCount: trial.tradeCount,
      isBest,
      acquisitionValue: ei.toString(),
      evaluationMs: trial.evaluationMs.toString(),
    });

    iteration++;
  }

  return bestResult;
}

// ---------------------------------------------------------------------------
// Public Entry Point
// ---------------------------------------------------------------------------

export async function startOptimizationRun(config: OptimizationConfig): Promise<string> {
  const totalIterations =
    config.method === "grid_search"
      ? Math.min(config.maxIterations ?? 10000, 10000)
      : config.maxIterations ?? (config.method === "genetic"
          ? (config.populationSize ?? 20) * (config.maxGenerations ?? 10)
          : 100);

  const run = await insertOptimizationRun({
    strategyName: config.strategyName,
    optimizationMethod: config.method,
    parameterSpace: config.parameterSpace as Record<string, unknown>,
    objective: config.objective,
    symbol: config.symbol,
    timeframe: config.timeframe,
    startDate: config.startDate,
    endDate: config.endDate,
    status: "pending",
    totalIterations,
    completedIterations: 0,
    populationSize: config.populationSize,
    maxGenerations: config.maxGenerations,
    explorationTrials: config.explorationTrials,
  });

  const runId = run.id;
  const startTime = Date.now();

  // Execute asynchronously (fire and forget — caller tracks via run ID)
  setImmediate(async () => {
    try {
      let bestResult: OptimizationTrialResult | null = null;

      switch (config.method) {
        case "grid_search":
          bestResult = await runGridSearch(config, runId);
          break;
        case "random_search":
          bestResult = await runRandomSearch(config, runId);
          break;
        case "bayesian":
          bestResult = await runBayesianSearch(config, runId);
          break;
        case "genetic":
          const { bestIndividual } = await runGeneticEvolution(config, runId);
          bestResult = bestIndividual.fitness !== undefined
            ? {
                parameters: bestIndividual.parameters,
                score: bestIndividual.fitness,
                sharpeRatio: (bestIndividual as unknown as Record<string, number>).sharpeRatio ?? 0,
                sortinoRatio: 0,
                totalReturn: (bestIndividual as unknown as Record<string, number>).totalReturn ?? 0,
                maxDrawdown: (bestIndividual as unknown as Record<string, number>).maxDrawdown ?? 0,
                winRate: 0,
                tradeCount: 0,
                profitFactor: 0,
                evaluationMs: 0,
              }
            : null;
          break;
      }

      const elapsed = (Date.now() - startTime) / 1000;

      await updateOptimizationRun(runId, {
        status: "completed",
        completedAt: new Date(),
        elapsedSeconds: elapsed.toString(),
        ...(bestResult
          ? {
              bestScore: bestResult.score.toString(),
              bestParameters: bestResult.parameters as Record<string, unknown>,
              bestSharpe: bestResult.sharpeRatio.toString(),
              bestTotalReturn: bestResult.totalReturn.toString(),
              bestMaxDrawdown: bestResult.maxDrawdown.toString(),
            }
          : {}),
      });

      // Record lineage for the best set of parameters
      if (bestResult) {
        await insertStrategyLineage({
          strategyName: `${config.strategyName}_optimized_${runId.slice(0, 8)}`,
          parentStrategyName: config.strategyName,
          ancestorChain: [config.strategyName] as unknown[],
          generationNumber: 1,
          mutationCount: 1,
          improvementDelta: bestResult.score.toString(),
          lineageType: "optimized",
          parameters: bestResult.parameters as Record<string, unknown>,
          creationMethod: config.method,
          optimizationRunId: runId,
        });
      }

      logger.info({ runId, method: config.method, elapsed }, "Optimization run completed");
    } catch (err) {
      logger.error({ err, runId }, "Optimization run failed");
      await updateOptimizationRun(runId, {
        status: "failed",
        completedAt: new Date(),
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return runId;
}

export { getOptimizationRunById, listOptimizationRuns, listOptimizationResults };
