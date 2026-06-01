import { Router, type IRouter } from "express";
import { z } from "zod";
import { executeMonteCarloSimulation } from "../../services/monte-carlo-runner";
import { getMonteCarloRun } from "../../services/phase4-db";
import { getBacktestRun } from "../../services/research-db";

const router: IRouter = Router();

const PostMonteCarloSchema = z.object({
  backtestRunId: z.string().uuid(),
  simulations: z.number().int().min(100).max(10000).optional().default(1000),
  seed: z.number().int().optional(),
  /** Capital threshold below which a simulation counts as ruin (0-1 fraction of initial) */
  ruinThreshold: z.number().min(0.01).max(0.99).optional().default(0.5),
});

/**
 * POST /v1/research/monte-carlo
 * Run a Monte Carlo simulation on the trades from a completed backtest.
 */
router.post("/research/monte-carlo", async (req, res) => {
  const parse = PostMonteCarloSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { backtestRunId, simulations, seed, ruinThreshold } = parse.data;

  // Verify the source backtest exists and is completed
  const sourceRun = await getBacktestRun(backtestRunId);
  if (!sourceRun) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `Backtest run not found: ${backtestRunId}` },
    });
    return;
  }
  if (sourceRun.status !== "completed") {
    res.status(400).json({
      error: {
        code: "RUN_NOT_COMPLETE",
        message: `Backtest run ${backtestRunId} is not completed (status: ${sourceRun.status})`,
      },
    });
    return;
  }

  const result = await executeMonteCarloSimulation({
    backtestRunId,
    simulations,
    seed,
    ruinThreshold,
  });

  res.status(result.status === "completed" ? 200 : 422).json(result);
});

/**
 * GET /v1/research/monte-carlo/:id
 * Get a specific Monte Carlo simulation result.
 */
router.get("/research/monte-carlo/:id", async (req, res) => {
  const { id } = req.params;

  const run = await getMonteCarloRun(id);
  if (!run) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `Monte Carlo run not found: ${id}` },
    });
    return;
  }

  const percentiles = run.percentiles ? JSON.parse(run.percentiles) : null;
  res.json({ run: { ...run, percentiles: undefined }, percentiles });
});

export default router;
