import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  createStrategyAssignment,
  updateAssignmentStatus,
  getAssignment,
  getActiveAssignments,
  getAllAssignments,
  getPaperAccount,
} from "../../services/paper-accounts-db";
import { listStrategyNames } from "../../strategies/registry";

const router: IRouter = Router();

const VALID_INTERVALS = ["1m", "5m", "15m", "30m", "1h", "4h", "1d", "1w"] as const;

const AssignSchema = z.object({
  accountId: z.string().uuid(),
  strategyName: z.string().min(1).max(100),
  symbol: z.string().min(1).max(30),
  interval: z.enum(VALID_INTERVALS),
  params: z.record(z.string(), z.union([z.number(), z.boolean()])).optional(),
});

const StatusActionSchema = z.object({
  assignmentId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

/**
 * POST /v1/paper/strategies/assign
 * Assign a strategy to a paper trading account.
 */
router.post("/paper/strategies/assign", async (req, res) => {
  const parse = AssignSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { accountId, strategyName, symbol, interval, params } = parse.data;

  // Validate account exists
  const account = await getPaperAccount(accountId);
  if (!account) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Account not found: ${accountId}` } });
    return;
  }

  // Validate strategy exists in registry
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

  const assignment = await createStrategyAssignment({
    accountId,
    strategyName,
    symbol: symbol.toUpperCase(),
    interval,
    params: params ? JSON.stringify(params) : null,
    status: "active",
  });

  res.status(201).json({ assignment });
});

/**
 * POST /v1/paper/strategies/pause
 * Pause an active strategy assignment.
 */
router.post("/paper/strategies/pause", async (req, res) => {
  const parse = StatusActionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { assignmentId, reason } = parse.data;

  const assignment = await getAssignment(assignmentId);
  if (!assignment) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Assignment not found: ${assignmentId}` } });
    return;
  }

  if (assignment.status !== "active") {
    res.status(409).json({
      error: { code: "INVALID_STATE", message: `Assignment is not active (current: ${assignment.status})` },
    });
    return;
  }

  await updateAssignmentStatus(assignmentId, "paused", reason);
  const updated = await getAssignment(assignmentId);

  res.json({ assignment: updated });
});

/**
 * POST /v1/paper/strategies/resume
 * Resume a paused strategy assignment.
 */
router.post("/paper/strategies/resume", async (req, res) => {
  const parse = StatusActionSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { assignmentId, reason } = parse.data;

  const assignment = await getAssignment(assignmentId);
  if (!assignment) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Assignment not found: ${assignmentId}` } });
    return;
  }

  if (assignment.status !== "paused") {
    res.status(409).json({
      error: { code: "INVALID_STATE", message: `Assignment is not paused (current: ${assignment.status})` },
    });
    return;
  }

  await updateAssignmentStatus(assignmentId, "active", reason);
  const updated = await getAssignment(assignmentId);

  res.json({ assignment: updated });
});

/**
 * GET /v1/paper/strategies/assignments
 * List strategy assignments, optionally filtered by accountId or status.
 */
router.get("/paper/strategies/assignments", async (req, res) => {
  const { accountId, status } = req.query as Record<string, string | undefined>;

  const VALID_STATUSES = ["active", "paused", "disabled"];
  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      },
    });
    return;
  }

  const assignments =
    status === "active"
      ? await getActiveAssignments(accountId)
      : await getAllAssignments(accountId);

  const filtered = status && status !== "active"
    ? assignments.filter((a) => a.status === status)
    : assignments;

  res.json({ data: filtered, total: filtered.length });
});

export default router;
