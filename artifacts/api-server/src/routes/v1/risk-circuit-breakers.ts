import { Router, type IRouter } from "express";
import { z } from "zod";
import { listCircuitBreakerEvents } from "../../services/risk-db";
import {
  getAllBreakerStates,
  getBreakerState,
  resetBreaker,
  type BreakerType,
} from "../../services/circuit-breaker-service";
import { appendAuditLog } from "../../services/risk-db";

const router: IRouter = Router();

const VALID_BREAKER_TYPES: BreakerType[] = [
  "loss_streak",
  "drawdown",
  "execution_failure",
  "volatility",
  "data_failure",
  "market_closure",
];

/**
 * GET /v1/risk/circuit-breakers
 * List current in-memory circuit breaker states and recent DB events.
 */
router.get("/risk/circuit-breakers", async (req, res) => {
  const { breakerType, state, accountId, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 100;

  // In-memory breaker states (current)
  const currentStates = getAllBreakerStates();

  // Historical events from DB
  const events = await listCircuitBreakerEvents({
    breakerType,
    state,
    accountId,
    limit: parsedLimit,
  });

  res.json({
    currentStates,
    events: { data: events, total: events.length },
  });
});

const ResetBreakerSchema = z.object({
  breakerType: z.enum(["loss_streak", "drawdown", "execution_failure", "volatility", "data_failure", "market_closure"]),
  accountId: z.string().uuid().optional(),
  strategyName: z.string().optional(),
  reason: z.string().min(1).max(500),
});

/**
 * POST /v1/risk/circuit-breakers/reset
 * Manually reset a triggered circuit breaker.
 */
router.post("/risk/circuit-breakers/reset", async (req, res) => {
  const parse = ResetBreakerSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { breakerType, accountId, strategyName, reason } = parse.data;

  await resetBreaker(breakerType as BreakerType, accountId, strategyName);

  await appendAuditLog({
    actor: "api",
    action: `circuit_breaker.reset.${breakerType}`,
    entityType: "circuit_breaker",
    entityId: `${breakerType}:${accountId ?? "global"}:${strategyName ?? "any"}`,
    payload: { breakerType, accountId, strategyName, reason },
    result: "success",
  });

  res.json({
    message: `Circuit breaker "${breakerType}" reset to active.`,
    breakerType,
    accountId: accountId ?? null,
    strategyName: strategyName ?? null,
    newState: "active",
  });
});

export default router;
