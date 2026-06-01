import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  activateKillSwitch,
  resumeKillSwitch,
  getKillSwitchStatus,
} from "../../services/kill-switch-service";
import { listKillSwitchEvents } from "../../services/risk-db";

const router: IRouter = Router();

const KillSwitchSchema = z.object({
  scope: z.enum(["strategy", "account", "portfolio", "trading", "scheduler"]),
  targetId: z.string().optional(),
  targetLabel: z.string().max(200).optional(),
  reason: z.string().min(1).max(1000),
});

/**
 * GET /v1/risk/kill-switch
 * Get current kill switch status (in-memory state + recent events).
 */
router.get("/risk/kill-switch", async (req, res) => {
  const status = getKillSwitchStatus();
  const recentEvents = await listKillSwitchEvents(50);

  res.json({ status, recentEvents });
});

/**
 * POST /v1/risk/kill-switch
 * Activate a kill switch (halt trading at the specified scope).
 */
router.post("/risk/kill-switch", async (req, res) => {
  const parse = KillSwitchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { scope, targetId, targetLabel, reason } = parse.data;

  // Validate: account/strategy scope requires targetId
  if ((scope === "account" || scope === "strategy") && !targetId) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `targetId is required for scope "${scope}"`,
      },
    });
    return;
  }

  await activateKillSwitch({ scope, targetId, targetLabel, reason });

  const status = getKillSwitchStatus();
  res.status(201).json({
    message: `Kill switch activated: scope=${scope}${targetId ? `, target=${targetId}` : ""}`,
    status,
  });
});

/**
 * POST /v1/risk/resume
 * Resume (deactivate) a kill switch at the specified scope.
 */
router.post("/risk/resume", async (req, res) => {
  const parse = KillSwitchSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { scope, targetId, reason } = parse.data;

  await resumeKillSwitch({ scope, targetId, reason });

  const status = getKillSwitchStatus();
  res.json({
    message: `Kill switch resumed: scope=${scope}${targetId ? `, target=${targetId}` : ""}`,
    status,
  });
});

export default router;
