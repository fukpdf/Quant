/**
 * genetic-evolution-engine.ts — Phase 11 Genetic Algorithm for Strategy Evolution.
 *
 * Evolves strategy parameter sets across generations to maximize a fitness
 * objective (Sharpe, Calmar, total return, etc.).
 *
 * Algorithm:
 *   1. Initialize population with random parameters within ParameterSpace bounds
 *   2. Evaluate each individual by running a backtest
 *   3. Select top N individuals by fitness (tournament + elitism)
 *   4. Crossover pairs to produce offspring
 *   5. Mutate offspring with configurable probability
 *   6. Repeat for max_generations or until convergence
 *
 * Each individual is persisted as a strategy_generation row.
 * Each mutation is recorded as a strategy_mutation row.
 *
 * Advisory only — this engine evolves simulation parameters, not live capital.
 */

import { logger } from "../lib/logger";
import {
  insertStrategyGeneration,
  insertStrategyMutation,
  updateGenerationFitness,
  listGenerations,
} from "./intelligence-db";
import { updateOptimizationRun, insertOptimizationResult } from "./intelligence-db";
import type {
  OptimizationConfig,
  ParameterSpace,
  Individual,
  Population,
  MutationType,
} from "./intelligence-types";


// ---------------------------------------------------------------------------
// Backtest Runner Integration
// ---------------------------------------------------------------------------

/**
 * Evaluate an individual by running a backtest via the research service.
 * Returns fitness score based on the configured objective.
 */
async function evaluateIndividual(
  individual: Individual,
  config: OptimizationConfig,
): Promise<{
  fitness: number;
  sharpeRatio: number;
  totalReturn: number;
  maxDrawdown: number;
  tradeCount: number;
}> {
  // Lazy-import to avoid circular dependency
  const { executeBacktest } = await import("./research-runner");
  const { createStrategy } = await import("../strategies/registry");
  const { db: _db } = await import("@workspace/db");
  const { performanceMetricsTable } = await import("@workspace/db/schema");
  const { eq: _eq } = await import("drizzle-orm");

  try {
    createStrategy(config.strategyName); // throws if strategy not registered
  } catch {
    throw new Error(`Strategy not found: ${config.strategyName}`);
  }

  try {
    const result = await executeBacktest({
      strategyName: config.strategyName,
      params: individual.parameters as Partial<import("../strategies/types").StrategyParams>,
      symbol: config.symbol,
      interval: config.timeframe,
      startDate: new Date(config.startDate),
      endDate: new Date(config.endDate),
      initialCapital: 10000,
    });

    // Look up persisted metrics for this run
    const [m] = result.runId
      ? await _db.select().from(performanceMetricsTable).where(_eq(performanceMetricsTable.backtestRunId, result.runId)).limit(1)
      : [];

    const sharpe = parseFloat(m?.sharpeRatio ?? "0");
    const totalReturn = parseFloat(m?.totalReturnPct ?? "0");
    const maxDD = parseFloat(m?.maxDrawdownPct ?? "0");
    const sortinoRatio = parseFloat(m?.sortinoRatio ?? "0");
    const profitFactor = parseFloat(m?.profitFactor ?? "0");
    const tradeCount = m?.totalTrades ?? 0;

    let fitness: number;
    switch (config.objective) {
      case "sharpe":
        fitness = sharpe;
        break;
      case "calmar":
        fitness = Math.abs(maxDD) > 0 ? totalReturn / Math.abs(maxDD) : totalReturn;
        break;
      case "total_return":
        fitness = totalReturn;
        break;
      case "sortino":
        fitness = sortinoRatio || sharpe;
        break;
      case "profit_factor":
        fitness = profitFactor || (sharpe > 0 ? 1.5 : 0.8);
        break;
      default:
        fitness = sharpe;
    }

    return {
      fitness: isFinite(fitness) ? fitness : 0,
      sharpeRatio: isFinite(sharpe) ? sharpe : 0,
      totalReturn: isFinite(totalReturn) ? totalReturn : 0,
      maxDrawdown: isFinite(maxDD) ? maxDD : 0,
      tradeCount: typeof tradeCount === "number" ? tradeCount : 0,
    };
  } catch (err) {
    logger.warn({ err, params: individual.parameters }, "Individual evaluation failed — assigning zero fitness");
    return { fitness: 0, sharpeRatio: 0, totalReturn: 0, maxDrawdown: 0, tradeCount: 0 };
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

function sampleParameter(range: ParameterSpace[string]): number {
  if (range.values && range.values.length > 0) {
    return range.values[Math.floor(Math.random() * range.values.length)] as number;
  }
  const { min, max, step, type } = range;
  if (step) {
    const steps = Math.floor((max - min) / step);
    const sampled = min + Math.floor(Math.random() * (steps + 1)) * step;
    return type === "int" ? Math.round(sampled) : sampled;
  }
  const v = min + Math.random() * (max - min);
  return type === "int" ? Math.round(v) : parseFloat(v.toFixed(6));
}

function initializePopulation(
  config: OptimizationConfig,
  populationId: string,
): Individual[] {
  const size = config.populationSize ?? 20;
  return Array.from({ length: size }, () => ({
    parameters: Object.fromEntries(
      Object.entries(config.parameterSpace).map(([k, r]) => [k, sampleParameter(r)]),
    ),
  }));
}

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

function tournamentSelect(population: Individual[], tournamentSize = 3): Individual {
  const candidates: Individual[] = [];
  for (let i = 0; i < tournamentSize; i++) {
    candidates.push(population[Math.floor(Math.random() * population.length)]);
  }
  return candidates.reduce((best, c) =>
    (c.fitness ?? -Infinity) > (best.fitness ?? -Infinity) ? c : best,
  );
}

// ---------------------------------------------------------------------------
// Crossover
// ---------------------------------------------------------------------------

function crossover(parentA: Individual, parentB: Individual): Individual {
  const child: Record<string, number> = {};
  const keys = Object.keys(parentA.parameters);
  const point = Math.floor(Math.random() * keys.length);
  for (let i = 0; i < keys.length; i++) {
    child[keys[i]] = i < point
      ? parentA.parameters[keys[i]]
      : parentB.parameters[keys[i]];
  }
  return { parameters: child };
}

// ---------------------------------------------------------------------------
// Mutation
// ---------------------------------------------------------------------------

function mutate(
  individual: Individual,
  parameterSpace: ParameterSpace,
  mutationRate: number,
  mutationStrength: number,
): { mutated: Individual; changes: Record<string, { before: number; after: number }> } {
  const newParams = { ...individual.parameters };
  const changes: Record<string, { before: number; after: number }> = {};

  for (const [key, range] of Object.entries(parameterSpace)) {
    if (Math.random() < mutationRate) {
      const before = newParams[key];
      const span = (range.max - range.min) * mutationStrength;
      const perturbation = (Math.random() - 0.5) * 2 * span;
      let newVal = before + perturbation;
      newVal = Math.max(range.min, Math.min(range.max, newVal));
      if (range.step) {
        newVal = Math.round(newVal / range.step) * range.step;
      }
      if (range.type === "int") newVal = Math.round(newVal);
      newParams[key] = parseFloat(newVal.toFixed(6));
      if (newParams[key] !== before) {
        changes[key] = { before, after: newParams[key] };
      }
    }
  }

  return { mutated: { parameters: newParams }, changes };
}

// ---------------------------------------------------------------------------
// Core Evolution Loop
// ---------------------------------------------------------------------------

export async function runGeneticEvolution(
  config: OptimizationConfig,
  optimizationRunId: string,
): Promise<{
  bestIndividual: Individual;
  generations: number;
  totalEvaluations: number;
}> {
  const populationId = crypto.randomUUID();
  const maxGenerations = config.maxGenerations ?? 10;
  const populationSize = config.populationSize ?? 20;
  const mutationRate = 0.2;
  const crossoverRate = 0.7;
  const elitismCount = Math.max(1, Math.floor(populationSize * 0.1));
  const mutationStrength = 0.3;

  logger.info(
    { populationId, maxGenerations, populationSize, strategy: config.strategyName },
    "Starting genetic evolution",
  );

  let population = initializePopulation(config, populationId);
  let bestIndividual: Individual = population[0];
  let totalEvaluations = 0;
  let genNumber = 0;

  await updateOptimizationRun(optimizationRunId, {
    status: "running",
    startedAt: new Date(),
    populationId,
  } as Parameters<typeof updateOptimizationRun>[1]);

  for (genNumber = 0; genNumber < maxGenerations; genNumber++) {
    logger.info({ gen: genNumber, popSize: population.length }, "Evaluating generation");

    // Persist and evaluate all individuals
    const evaluated: Individual[] = [];
    for (const ind of population) {
      const dbRow = await insertStrategyGeneration({
        strategyName: config.strategyName,
        generationNumber: genNumber,
        populationId,
        parentGenerationId: ind.id ? undefined : undefined,
        parameters: ind.parameters as Record<string, unknown>,
        status: "evaluating",
        evaluationSymbol: config.symbol,
        evaluationTimeframe: config.timeframe,
      });

      const perf = await evaluateIndividual(ind, config);
      totalEvaluations++;

      await updateGenerationFitness(dbRow.id, {
        fitnessScore: perf.fitness.toString(),
        sharpeRatio: perf.sharpeRatio.toString(),
        totalReturn: perf.totalReturn.toString(),
        maxDrawdown: perf.maxDrawdown.toString(),
        tradeCount: perf.tradeCount,
        status: "evaluated",
        rankInGeneration: 0,
        evaluatedAt: new Date(),
      });

      // Persist as optimization result
      await insertOptimizationResult({
        runId: optimizationRunId,
        iterationNumber: totalEvaluations,
        parameters: ind.parameters as Record<string, unknown>,
        score: perf.fitness.toString(),
        sharpeRatio: perf.sharpeRatio.toString(),
        totalReturn: perf.totalReturn.toString(),
        maxDrawdown: perf.maxDrawdown.toString(),
        winRate: "0",
        tradeCount: perf.tradeCount,
        isBest: false,
        generationId: dbRow.id,
        evaluationMs: "0",
      });

      const evalInd = { ...ind, id: dbRow.id, ...perf };
      evaluated.push(evalInd);
    }

    // Sort by fitness descending
    evaluated.sort((a, b) => (b.fitness ?? 0) - (a.fitness ?? 0));

    // Update ranks
    for (let i = 0; i < evaluated.length; i++) {
      if (evaluated[i].id) {
        await updateGenerationFitness(evaluated[i].id!, {
          fitnessScore: (evaluated[i].fitness ?? 0).toString(),
          sharpeRatio: (evaluated[i].sharpeRatio ?? 0).toString(),
          totalReturn: (evaluated[i].totalReturn ?? 0).toString(),
          maxDrawdown: (evaluated[i].maxDrawdown ?? 0).toString(),
          tradeCount: evaluated[i].tradeCount ?? 0,
          status: i === 0 ? "active" : "evaluated",
          rankInGeneration: i + 1,
          evaluatedAt: new Date(),
        });
      }
    }

    if ((evaluated[0]?.fitness ?? 0) > (bestIndividual.fitness ?? -Infinity)) {
      bestIndividual = evaluated[0];
      await updateOptimizationRun(optimizationRunId, {
        bestScore: (bestIndividual.fitness ?? 0).toString(),
        bestParameters: bestIndividual.parameters as Record<string, unknown>,
        completedIterations: totalEvaluations,
      });
    }

    // Build next generation
    const nextPop: Individual[] = [];

    // Elitism: carry forward best individuals unchanged
    for (let i = 0; i < Math.min(elitismCount, evaluated.length); i++) {
      nextPop.push({ parameters: { ...evaluated[i].parameters }, id: undefined });
    }

    // Crossover + mutation to fill the rest
    while (nextPop.length < populationSize) {
      const parentA = tournamentSelect(evaluated);
      const parentB = tournamentSelect(evaluated);

      let child: Individual;
      let mutationType: MutationType;

      if (Math.random() < crossoverRate) {
        child = crossover(parentA, parentB);
        mutationType = "crossover";
      } else {
        child = { parameters: { ...parentA.parameters } };
        mutationType = "random";
      }

      const { mutated, changes } = mutate(child, config.parameterSpace, mutationRate, mutationStrength);
      mutated.id = undefined;
      nextPop.push(mutated);

      // Record mutation
      if (parentA.id) {
        await insertStrategyMutation({
          generationId: parentA.id,
          parentGenerationId: parentA.id,
          secondaryParentId: mutationType === "crossover" ? parentB.id : undefined,
          mutationType,
          parameterChanges: changes as Record<string, unknown>,
          mutationStrength: mutationStrength.toString(),
          parentFitness: (parentA.fitness ?? 0).toString(),
          wasImprovement: false,
        });
      }
    }

    population = nextPop;

    logger.info(
      { gen: genNumber, bestFitness: bestIndividual.fitness },
      "Generation complete",
    );
  }

  await updateOptimizationRun(optimizationRunId, {
    status: "completed",
    completedAt: new Date(),
    completedIterations: totalEvaluations,
  });

  return { bestIndividual, generations: genNumber, totalEvaluations };
}

export { listGenerations };
