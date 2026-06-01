import { Router, type IRouter } from "express";
import { z } from "zod";
import { executeWalkForward } from "../../services/walk-forward-runner";
import { getWalkForwardRun, listWalkForwardRuns } from "../../services/phase4-db";
import { listStrategyNames } from "../../strategies/registry";

const router: IRouter = Router();

const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

const PostWalkForwardSchema = z.object({
  strategyName: z.string().min(1).max(100),
  symbol: z.string().min(1).max(30),
  interval: z.enum(VALID_INTERVALS),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialCapital: z.number().positive().optional().default(10000),
  params: z.record(z.string(), z.union([z.number(), z.boolean()])).optional().default({}),
  /** Fraction of each window for in-sample training (0.5 – 0.9) */
  inSamplePct: z.number().min(0.4).max(0.95).optional().default(0.7),
  /** Number of walk-forward windows */
  windowCount: z.number().int().min(2).max(20).optional().default(5),
  /** rolling or expanding window type */
  windowType: z.enum(["rolling", "expanding"]).optional().default("rolling"),
});

/**
 * POST /v1/research/walk-forward
 * Execute a walk-forward validation test for a strategy.
 */
router.post("/research/walk-forward", async (req, res) => {
  const parse = PostWalkForwardSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { strategyName, symbol, interval, startDate, endDate, initialCapital, params, inSamplePct, windowCount, windowType } = parse.data;

  const knownStrategies = listStrategyNames();
  if (!knownStrategies.includes(strategyName)) {
    res.status(400).json({
      error: {
        code: "UNKNOWN_STRATEGY",
        message: `Unknown strategy "${strategyName}". Available: ${knownStrategies.join(", ")}`,
      },
    });
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    res.status(400).json({
      error: { code: "INVALID_DATE_RANGE", message: "startDate must be before endDate" },
    });
    return;
  }

  const result = await executeWalkForward({
    strategyName,
    symbol,
    interval,
    startDate: start,
    endDate: end,
    params,
    initialCapital,
    inSamplePct,
    windowCount,
    windowType,
  });

  res.status(result.status === "completed" ? 200 : 422).json(result);
});

/**
 * GET /v1/research/walk-forward/:id
 * Get a specific walk-forward run with all window results.
 */
router.get("/research/walk-forward/:id", async (req, res) => {
  const { id } = req.params;

  const run = await getWalkForwardRun(id);
  if (!run) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `Walk-forward run not found: ${id}` },
    });
    return;
  }

  const windowResults = run.windowResults ? JSON.parse(run.windowResults) : null;
  res.json({ run: { ...run, windowResults: undefined }, windowResults });
});

export default router;
