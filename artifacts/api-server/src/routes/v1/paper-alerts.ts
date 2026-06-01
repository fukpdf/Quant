import { Router, type IRouter } from "express";
import { listPaperAlerts, getPaperAccount } from "../../services/paper-accounts-db";

const router: IRouter = Router();

const VALID_SEVERITIES = ["info", "warning", "critical"];

/**
 * GET /v1/paper/alerts
 * List paper trading alerts.
 *
 * Filters:
 *   - accountId (optional — omit to get all account alerts)
 *   - severity (optional: info | warning | critical)
 *   - acknowledged (optional: true | false)
 *   - limit (optional, max 500, default 100)
 */
router.get("/paper/alerts", async (req, res) => {
  const {
    accountId,
    severity,
    acknowledged: acknowledgedStr,
    limit: limitStr,
  } = req.query as Record<string, string | undefined>;

  // Validate account if provided
  if (accountId) {
    const account = await getPaperAccount(accountId);
    if (!account) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: `Account not found: ${accountId}` } });
      return;
    }
  }

  if (severity && !VALID_SEVERITIES.includes(severity)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid severity. Must be one of: ${VALID_SEVERITIES.join(", ")}`,
      },
    });
    return;
  }

  let acknowledged: boolean | undefined;
  if (acknowledgedStr === "true") acknowledged = true;
  else if (acknowledgedStr === "false") acknowledged = false;

  const limit = limitStr ? Math.min(parseInt(limitStr, 10), 500) : 100;
  if (isNaN(limit) || limit <= 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid limit" } });
    return;
  }

  const alerts = await listPaperAlerts(accountId, { acknowledged, severity, limit });
  res.json({ data: alerts, total: alerts.length });
});

export default router;
