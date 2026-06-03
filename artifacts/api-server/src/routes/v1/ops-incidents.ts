import { Router } from "express";
import { z } from "zod/v4";
import {
  listIncidents,
  getIncidentById,
  listIncidentTimeline,
} from "../../services/ops-db";
import {
  resolveIncident,
  investigateIncident,
  addIncidentUpdate,
} from "../../services/incident-manager";

/**
 * ops-incidents.ts — Incident management endpoints.
 *
 * GET  /v1/ops/incidents                      — list incidents
 * GET  /v1/ops/incidents/:id                  — get incident + timeline
 * POST /v1/ops/incidents/:id/investigate      — mark investigating
 * POST /v1/ops/incidents/:id/resolve          — resolve incident
 * POST /v1/ops/incidents/:id/update           — add timeline update
 */

const router = Router();

const ResolveSchema = z.object({
  resolution: z.string().min(1).max(2000),
  actor: z.string().max(100).optional().default("operator"),
});

const UpdateSchema = z.object({
  message: z.string().min(1).max(2000),
  actor: z.string().max(100).optional().default("operator"),
});

// GET /v1/ops/incidents
router.get("/ops/incidents", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const incidents = await listIncidents({ status, severity, limit, offset });
    return res.json({ data: incidents, count: incidents.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list incidents");
    return res.status(500).json({ error: "Failed to list incidents" });
  }
});

// GET /v1/ops/incidents/:id
router.get("/ops/incidents/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [incident, timeline] = await Promise.all([
      getIncidentById(id),
      listIncidentTimeline(id),
    ]);
    if (!incident) {
      return res.status(404).json({ error: "Incident not found" });
    }
    return res.json({ data: { ...incident, timeline } });
  } catch (err) {
    req.log?.error({ err }, "Failed to get incident");
    return res.status(500).json({ error: "Failed to get incident" });
  }
});

// POST /v1/ops/incidents/:id/investigate
router.post("/ops/incidents/:id/investigate", async (req, res) => {
  const { id } = req.params;
  try {
    const ok = await investigateIncident(id);
    if (!ok) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const incident = await getIncidentById(id);
    return res.json({ data: incident, message: "Incident marked as investigating" });
  } catch (err) {
    req.log?.error({ err }, "Failed to investigate incident");
    return res.status(500).json({ error: "Failed to investigate incident" });
  }
});

// POST /v1/ops/incidents/:id/resolve
router.post("/ops/incidents/:id/resolve", async (req, res) => {
  const { id } = req.params;
  const parsed = ResolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    const ok = await resolveIncident(id, parsed.data.resolution, parsed.data.actor);
    if (!ok) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const incident = await getIncidentById(id);
    return res.json({ data: incident, message: "Incident resolved" });
  } catch (err) {
    req.log?.error({ err }, "Failed to resolve incident");
    return res.status(500).json({ error: "Failed to resolve incident" });
  }
});

// POST /v1/ops/incidents/:id/update
router.post("/ops/incidents/:id/update", async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  try {
    const ok = await addIncidentUpdate(id, parsed.data.message, parsed.data.actor);
    if (!ok) {
      return res.status(404).json({ error: "Incident not found" });
    }
    const timeline = await listIncidentTimeline(id);
    return res.status(201).json({ data: timeline[timeline.length - 1], message: "Update added" });
  } catch (err) {
    req.log?.error({ err }, "Failed to add incident update");
    return res.status(500).json({ error: "Failed to add incident update" });
  }
});

export default router;
