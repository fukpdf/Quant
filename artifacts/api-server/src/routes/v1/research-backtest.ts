import { Router, type IRouter } from "express";
import { z } from "zod";
import { executeBacktest } from "../../services/research-runner";
import { getBacktestRun, getMetricsForRun, getTradesForRun } from "../../services/research-db";
import { listStrategyNames } from "../../strategies/registry";

const router: IRouter = Router();

const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

const PostBacktestSchema = z.object({
  strategyName: z.string().min(1).max(100),
  symbol: z.string().min(1).max(30),
  interval: z.enum(VALID_INTERVALS),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialCapital: z.number().positive().optional().default(10000),
  params: z.record(z.string(), z.union([z.number(), z.boolean()])).optional().default({}),
});

/**
 * POST /v1/research/backtest
 * Run a backtest for a given strategy, symbol, interval, and date range.
 * Executes synchronously and returns the full result.
 */
router.post("/research/backtest", async (req, res) => {
  const parse = PostBacktestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { strategyName, symbol, interval, startDate, endDate, initialCapital, params } =
    parse.data;

  // Validate strategy name is known
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

  // Validate date ordering
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start >= end) {
    res.status(400).json({
      error: { code: "INVALID_DATE_RANGE", message: "startDate must be before endDate" },
    });
    return;
  }

  const result = await executeBacktest({
    strategyName,
    symbol,
    interval,
    startDate: start,
    endDate: end,
    params,
    initialCapital,
  });

  res.status(result.status === "completed" ? 200 : 422).json(result);
});

/**
 * GET /v1/research/backtest/:id
 * Retrieve a specific backtest run, including its performance metrics and trades.
 */
router.get("/research/backtest/:id", async (req, res) => {
  const { id } = req.params;

  const run = await getBacktestRun(id);
  if (!run) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `Backtest run not found: ${id}` },
    });
    return;
  }

  const [metrics, trades] = await Promise.all([
    getMetricsForRun(id),
    run.status === "completed" ? getTradesForRun(id) : Promise.resolve([]),
  ]);

  res.json({ run, metrics, trades });
});

export default router;
