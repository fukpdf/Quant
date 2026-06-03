import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { createOrgTeam, getTeamById, listOrgTeams, updateOrgTeam } from "../../services/tenant-service";

const router: IRouter = Router();

/**
 * GET /v1/organizations/:orgId/teams
 * List teams in an organization.
 */
router.get("/organizations/:orgId/teams", resolveAuth, requireAuth, async (req, res) => {
  const { orgId } = req.params as Record<string, string>;
  try {
    const teams = await listOrgTeams(orgId);
    res.json({ data: teams, total: teams.length });
  } catch (err) {
    req.log.error({ err }, "List teams failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list teams." } });
  }
});

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

/**
 * POST /v1/organizations/:orgId/teams
 * Create a team in an organization. Requires users:write.
 */
router.post("/organizations/:orgId/teams", resolveAuth, requireAuth, requirePermission("users:write"), async (req, res) => {
  const auth = req.auth!;
  const { orgId } = req.params as Record<string, string>;
  const parse = CreateTeamSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const team = await createOrgTeam({ ...parse.data, organizationId: orgId, createdBy: auth.userId, createdByEmail: auth.email });
    res.status(201).json({ team });
  } catch (err) {
    req.log.error({ err }, "Create team failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create team." } });
  }
});

/**
 * GET /v1/teams/:teamId
 * Get a team by ID.
 */
router.get("/teams/:teamId", resolveAuth, requireAuth, async (req, res) => {
  const { teamId } = req.params as Record<string, string>;
  try {
    const team = await getTeamById(teamId);
    if (!team) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Team not found." } });
      return;
    }
    res.json({ team });
  } catch (err) {
    req.log.error({ err }, "Get team failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get team." } });
  }
});

const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
});

/**
 * PATCH /v1/teams/:teamId
 * Update a team. Requires users:write.
 */
router.patch("/teams/:teamId", resolveAuth, requireAuth, requirePermission("users:write"), async (req, res) => {
  const auth = req.auth!;
  const { teamId } = req.params as Record<string, string>;
  const parse = UpdateTeamSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const data = { name: parse.data.name, description: parse.data.description ?? undefined };
    const updated = await updateOrgTeam(teamId, data, auth.userId, auth.email);
    if (!updated) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Team not found." } });
      return;
    }
    res.json({ team: updated });
  } catch (err) {
    req.log.error({ err }, "Update team failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update team." } });
  }
});

export default router;
