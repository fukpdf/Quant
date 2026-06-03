import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission, requireSuperAdmin } from "../../middleware/rbac-middleware";
import { createOrg, getOrgById, updateOrg, listOrgs, getUserOrgs } from "../../services/tenant-service";

const router: IRouter = Router();

/**
 * GET /v1/organizations
 * Super admin: list all orgs. Regular user: list own orgs.
 */
router.get("/organizations", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  try {
    if (auth.isSuperAdmin) {
      const orgs = await listOrgs();
      res.json({ data: orgs, total: orgs.length });
    } else {
      const { listMembershipsByUser, findOrganizationById } = await import("../../services/auth-db");
      const memberships = await listMembershipsByUser(auth.userId);
      const orgs = await Promise.all(memberships.map(m => findOrganizationById(m.organizationId)));
      const activeOrgs = orgs.filter(Boolean);
      res.json({ data: activeOrgs, total: activeOrgs.length });
    }
  } catch (err) {
    req.log.error({ err }, "List organizations failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list organizations." } });
  }
});

/**
 * POST /v1/organizations
 * Create a new organization.
 */
const CreateOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  description: z.string().max(500).optional(),
});

router.post("/organizations", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const parse = CreateOrgSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const org = await createOrg({ ...parse.data, createdBy: auth.userId, createdByEmail: auth.email });
    res.status(201).json({ organization: org });
  } catch (err: any) {
    if (err?.code === "SLUG_TAKEN") {
      res.status(409).json({ error: { code: "SLUG_TAKEN", message: "Organization slug is already taken." } });
      return;
    }
    req.log.error({ err }, "Create organization failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create organization." } });
  }
});

/**
 * GET /v1/organizations/:orgId
 * Get an organization by ID.
 */
router.get("/organizations/:orgId", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const { orgId } = req.params as Record<string, string>;
  try {
    const org = await getOrgById(orgId);
    if (!org) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Organization not found." } });
      return;
    }
    if (!auth.isSuperAdmin) {
      const { findMembership } = await import("../../services/auth-db");
      const m = await findMembership(auth.userId, orgId);
      if (!m?.isActive) {
        res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied." } });
        return;
      }
    }
    res.json({ organization: org });
  } catch (err) {
    req.log.error({ err }, "Get organization failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get organization." } });
  }
});

const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  settings: z.record(z.unknown()).optional().nullable(),
});

/**
 * PATCH /v1/organizations/:orgId
 * Update an organization. Requires membership with admin or owner role.
 */
router.patch("/organizations/:orgId", resolveAuth, requireAuth, requirePermission("users:write"), async (req, res) => {
  const auth = req.auth!;
  const { orgId } = req.params as Record<string, string>;
  const parse = UpdateOrgSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const updated = await updateOrg(orgId, parse.data as any, auth.userId, auth.email);
    if (!updated) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Organization not found." } });
      return;
    }
    res.json({ organization: updated });
  } catch (err) {
    req.log.error({ err }, "Update organization failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update organization." } });
  }
});

export default router;
