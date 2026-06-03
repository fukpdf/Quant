import { Router } from "express";
import { z } from "zod/v4";
import {
  listAlertEvents,
  acknowledgeAlert,
  resolveAlert,
  listAlertRules,
  updateAlertRuleEnabled,
  insertMonitoringAuditLog,
} from "../../services/ops-db";

/**
 * ops-alerts.ts — Alert events and rules endpoints.
 *
 * GET  /v1/ops/alerts                       — list alert events
 * POST /v1/ops/alerts/:id/acknowledge       — acknowledge an alert
 * POST /v1/ops/alerts/:id/resolve           — resolve an alert
 * GET  /v1/ops/alert-rules                  — list alert rules
 * PATCH /v1/ops/alert-rules/:name           — enable/disable a rule
 */

const router = Router();

const PatchAlertRuleSchema = z.object({
  isEnabled: z.boolean(),
});

// GET /v1/ops/alerts
router.get("/ops/alerts", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const service = typeof req.query.service === "string" ? req.query.service : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  const sinceStr = typeof req.query.since === "string" ? req.query.since : undefined;
  const since = sinceStr ? new Date(sinceStr) : undefined;

  try {
    const events = await listAlertEvents({ status, severity, service, since, limit, offset });
    return res.json({ data: events, count: events.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list alert events");
    return res.status(500).json({ error: "Failed to list alert events" });
  }
});

// POST /v1/ops/alerts/:id/acknowledge
router.post("/ops/alerts/:id/acknowledge", async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await acknowledgeAlert(id);
    if (!updated) {
      return res.status(404).json({ error: "Alert not found or not in active state" });
    }
    await insertMonitoringAuditLog({
      actor: "operator",
      action: "alert_acknowledged",
      targetType: "alert",
      targetId: id,
      description: `Alert ${id} acknowledged`,
    });
    return res.json({ data: updated });
  } catch (err) {
    req.log?.error({ err }, "Failed to acknowledge alert");
    return res.status(500).json({ error: "Failed to acknowledge alert" });
  }
});

// POST /v1/ops/alerts/:id/resolve
router.post("/ops/alerts/:id/resolve", async (req, res) => {
  const { id } = req.params;
  try {
    const updated = await resolveAlert(id);
    if (!updated) {
      return res.status(404).json({ error: "Alert not found" });
    }
    await insertMonitoringAuditLog({
      actor: "operator",
      action: "alert_resolved",
      targetType: "alert",
      targetId: id,
      description: `Alert ${id} resolved`,
    });
    return res.json({ data: updated });
  } catch (err) {
    req.log?.error({ err }, "Failed to resolve alert");
    return res.status(500).json({ error: "Failed to resolve alert" });
  }
});

// GET /v1/ops/alert-rules
router.get("/ops/alert-rules", async (req, res) => {
  const category = typeof req.query.category === "string" ? req.query.category : undefined;
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const enabledStr = typeof req.query.enabled === "string" ? req.query.enabled : undefined;
  const enabled = enabledStr !== undefined ? enabledStr === "true" : undefined;

  try {
    const rules = await listAlertRules({ category, severity, enabled });
    return res.json({ data: rules, count: rules.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list alert rules");
    return res.status(500).json({ error: "Failed to list alert rules" });
  }
});

// PATCH /v1/ops/alert-rules/:name
router.patch("/ops/alert-rules/:name", async (req, res) => {
  const { name } = req.params;
  const parsed = PatchAlertRuleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    const updated = await updateAlertRuleEnabled(name, parsed.data.isEnabled);
    if (!updated) {
      return res.status(404).json({ error: "Alert rule not found" });
    }
    await insertMonitoringAuditLog({
      actor: "operator",
      action: parsed.data.isEnabled ? "rule_enabled" : "rule_disabled",
      targetType: "rule",
      targetId: name,
      description: `Alert rule '${name}' ${parsed.data.isEnabled ? "enabled" : "disabled"}`,
    });
    return res.json({ data: updated });
  } catch (err) {
    req.log?.error({ err }, "Failed to update alert rule");
    return res.status(500).json({ error: "Failed to update alert rule" });
  }
});

export default router;
