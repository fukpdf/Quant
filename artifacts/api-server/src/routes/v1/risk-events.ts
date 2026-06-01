import { Router, type IRouter } from "express";
import {
  listRiskEvents,
  listRiskViolations,
  listPortfolioRiskSnapshots,
  listDrawdownEvents,
} from "../../services/risk-db";

const router: IRouter = Router();

/**
 * GET /v1/risk/events
 * List operational risk events.
 */
router.get("/risk/events", async (req, res) => {
  const { accountId, severity, resolved, limit } = req.query as Record<string, string | undefined>;

  const VALID_SEVERITIES = ["info", "warning", "critical"];
  if (severity && !VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: `severity must be one of: ${VALID_SEVERITIES.join(", ")}` },
    });
    return;
  }

  const parsedLimit = limit ? parseInt(limit, 10) : 100;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–1000" } });
    return;
  }

  const resolvedBool = resolved === "true" ? true : resolved === "false" ? false : undefined;

  const events = await listRiskEvents({
    accountId,
    severity,
    resolved: resolvedBool,
    limit: parsedLimit,
  });

  res.json({ data: events, total: events.length });
});

/**
 * GET /v1/risk/violations
 * List confirmed risk rule violations.
 */
router.get("/risk/violations", async (req, res) => {
  const { accountId, ruleType, severity, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 100;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 1000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–1000" } });
    return;
  }

  const violations = await listRiskViolations({
    accountId,
    ruleType,
    severity,
    limit: parsedLimit,
  });

  res.json({ data: violations, total: violations.length });
});

/**
 * GET /v1/risk/snapshots
 * List portfolio risk snapshots for an account.
 */
router.get("/risk/snapshots", async (req, res) => {
  const { accountId, limit } = req.query as Record<string, string | undefined>;

  if (!accountId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "accountId is required" } });
    return;
  }

  const parsedLimit = limit ? parseInt(limit, 10) : 90;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–500" } });
    return;
  }

  const snapshots = await listPortfolioRiskSnapshots(accountId, parsedLimit);
  res.json({ data: snapshots, total: snapshots.length });
});

/**
 * GET /v1/risk/drawdown-events
 * List drawdown threshold breach events.
 */
router.get("/risk/drawdown-events", async (req, res) => {
  const { accountId, resolved, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 100;
  const resolvedBool = resolved === "true" ? true : resolved === "false" ? false : undefined;

  const events = await listDrawdownEvents({
    accountId,
    resolved: resolvedBool,
    limit: parsedLimit,
  });

  res.json({ data: events, total: events.length });
});

export default router;
