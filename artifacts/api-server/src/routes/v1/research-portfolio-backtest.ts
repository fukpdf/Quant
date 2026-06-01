import { Router, type IRouter } from "express";
import { z } from "zod";
import { executePortfolioBacktest } from "../../services/portfolio-engine";
import { getPortfolioBacktest, listPortfolioBacktests } from "../../services/phase4-db";
import { getEquityCurveForPortfolio } from "../../services/equity-curve-service";
import { listStrategyNames } from "../../strategies/registry";

const router: IRouter = Router();

const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

const CostModelSchema = z.object({
  commissionType: z.enum(["flat", "percentage", "maker_taker"]).default("percentage"),
  commissionValue: z.number().min(0).default(0),
  makerFee: z.number().min(0).default(0),
  takerFee: z.number().min(0).default(0),
  slippageType: z.enum(["fixed", "percentage", "volatility_based", "volume_based"]).default("percentage"),
  slippageValue: z.number().min(0).default(0),
}).optional();

const PositionSizingSchema = z.object({
  method: z.enum(["fixed_dollar", "fixed_percentage", "risk_percentage", "volatility_based", "kelly"]).default("fixed_percentage"),
  value: z.number().positive().default(1.0),
  maxPositionPct: z.number().min(0.01).max(1.0).default(1.0),
  atrPeriod: z.number().int().min(2).max(200).default(14),
  atrRiskMultiple: z.number().positive().default(2.0),
  kellyFraction: z.number().min(0.01).max(1.0).default(0.25),
}).optional();

const PostPortfolioBacktestSchema = z.object({
  name: z.string().max(200).optional(),
  strategyName: z.string().min(1).max(100),
  symbols: z.array(z.string().min(1).max(30)).min(1).max(20),
  interval: z.enum(VALID_INTERVALS),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  initialCapital: z.number().positive().optional().default(10000),
  params: z.record(z.string(), z.union([z.number(), z.boolean()])).optional().default({}),
  costModel: CostModelSchema,
  positionSizing: PositionSizingSchema,
});

/**
 * POST /v1/research/portfolio-backtest
 * Run a strategy across multiple symbols with portfolio-level tracking.
 */
router.post("/research/portfolio-backtest", async (req, res) => {
  const parse = PostPortfolioBacktestSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { name, strategyName, symbols, interval, startDate, endDate, initialCapital, params, costModel, positionSizing } = parse.data;

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

  const result = await executePortfolioBacktest({
    name,
    strategyName,
    symbols,
    interval,
    startDate: start,
    endDate: end,
    params,
    initialCapital,
    costModel: costModel as any,
    positionSizing: positionSizing as any,
  });

  res.status(result.status === "completed" ? 200 : 422).json(result);
});

/**
 * GET /v1/research/portfolio-backtest/:id
 * Get a specific portfolio backtest with equity curve.
 */
router.get("/research/portfolio-backtest/:id", async (req, res) => {
  const { id } = req.params;

  const run = await getPortfolioBacktest(id);
  if (!run) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: `Portfolio backtest not found: ${id}` },
    });
    return;
  }

  const equityCurve = run.status === "completed"
    ? await getEquityCurveForPortfolio(id)
    : null;

  const portfolioMetrics = run.portfolioMetrics
    ? JSON.parse(run.portfolioMetrics)
    : null;

  res.json({ run: { ...run, portfolioMetrics: undefined }, portfolioMetrics, equityCurve });
});

export default router;
