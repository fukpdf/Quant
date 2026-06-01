import { getBacktestRun, getMetricsForRun } from "./research-db";
import type { BacktestRun, PerformanceMetrics } from "@workspace/db";

/**
 * Comparison engine.
 * Takes two (or more) backtest run IDs and returns a side-by-side comparison
 * of their performance metrics. Highlights the winner on each metric.
 */

export interface RunSummary {
  run: BacktestRun;
  metrics: PerformanceMetrics | null;
}

export interface MetricComparison {
  metric: string;
  label: string;
  /** Format hint for the UI */
  format: "percent" | "ratio" | "integer" | "decimal";
  /** Higher is better (true) or lower is better (false) */
  higherIsBetter: boolean;
  values: Record<string, number | null>;
  /** ID of the run with the best value, null if tied or missing data */
  winnerId: string | null;
}

export interface ComparisonResult {
  runIds: string[];
  summaries: RunSummary[];
  comparisons: MetricComparison[];
  overallWinnerId: string | null;
}

const METRIC_DEFINITIONS: Array<{
  key: keyof PerformanceMetrics;
  label: string;
  format: MetricComparison["format"];
  higherIsBetter: boolean;
}> = [
  { key: "totalReturnPct", label: "Total Return", format: "percent", higherIsBetter: true },
  { key: "annualizedReturnPct", label: "Annualized Return", format: "percent", higherIsBetter: true },
  { key: "winRate", label: "Win Rate", format: "percent", higherIsBetter: true },
  { key: "profitFactor", label: "Profit Factor", format: "ratio", higherIsBetter: true },
  { key: "maxDrawdownPct", label: "Max Drawdown", format: "percent", higherIsBetter: false },
  { key: "sharpeRatio", label: "Sharpe Ratio", format: "ratio", higherIsBetter: true },
  { key: "sortinoRatio", label: "Sortino Ratio", format: "ratio", higherIsBetter: true },
  { key: "expectancy", label: "Expectancy", format: "percent", higherIsBetter: true },
  { key: "totalTrades", label: "Total Trades", format: "integer", higherIsBetter: false },
  { key: "avgWinPct", label: "Avg Win", format: "percent", higherIsBetter: true },
  { key: "avgLossPct", label: "Avg Loss", format: "percent", higherIsBetter: false },
];

export async function compareRuns(runIds: string[]): Promise<ComparisonResult> {
  if (runIds.length < 2) {
    throw new Error("At least 2 run IDs are required for comparison");
  }

  // Fetch all runs and metrics in parallel
  const summaries: RunSummary[] = await Promise.all(
    runIds.map(async (id) => {
      const run = await getBacktestRun(id);
      if (!run) {
        throw new Error(`Backtest run not found: ${id}`);
      }
      const metrics = await getMetricsForRun(id);
      return { run, metrics };
    }),
  );

  // Build per-metric comparisons
  const comparisons: MetricComparison[] = METRIC_DEFINITIONS.map((def) => {
    const values: Record<string, number | null> = {};

    for (const { run, metrics } of summaries) {
      if (!metrics) {
        values[run.id] = null;
        continue;
      }
      const raw = metrics[def.key];
      if (raw === null || raw === undefined) {
        values[run.id] = null;
      } else {
        values[run.id] = typeof raw === "number" ? raw : parseFloat(String(raw));
      }
    }

    // Determine winner
    let winnerId: string | null = null;
    let bestValue: number | null = null;

    for (const [id, value] of Object.entries(values)) {
      if (value === null) continue;
      if (bestValue === null) {
        bestValue = value;
        winnerId = id;
        continue;
      }
      const isBetter = def.higherIsBetter ? value > bestValue : value < bestValue;
      if (isBetter) {
        bestValue = value;
        winnerId = id;
      } else if (value === bestValue) {
        winnerId = null; // tie
      }
    }

    return {
      metric: def.key,
      label: def.label,
      format: def.format,
      higherIsBetter: def.higherIsBetter,
      values,
      winnerId,
    };
  });

  // Overall winner: count metric wins
  const winCounts: Record<string, number> = {};
  for (const id of runIds) winCounts[id] = 0;

  for (const comp of comparisons) {
    if (comp.winnerId) {
      winCounts[comp.winnerId] = (winCounts[comp.winnerId] ?? 0) + 1;
    }
  }

  let overallWinnerId: string | null = null;
  let maxWins = -1;
  let tie = false;

  for (const [id, wins] of Object.entries(winCounts)) {
    if (wins > maxWins) {
      maxWins = wins;
      overallWinnerId = id;
      tie = false;
    } else if (wins === maxWins) {
      tie = true;
    }
  }

  if (tie) overallWinnerId = null;

  return { runIds, summaries, comparisons, overallWinnerId };
}
