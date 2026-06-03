import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { getOrgMembers, addMember, removeMember, updateMemberRole } from "../../services/tenant-service";
import { findUserById } from "../../services/auth-db";

const router: IRouter = Router();

/**
 * GET /v1/organizations/:orgId/members
 * List all members of an organization.
 */
router.get("/organizations/:orgId/members", resolveAuth, requireAuth, async (req, res) => {
  const { orgId } = req.params as Record<string, string>;
  try {
    const memberships = await getOrgMembers(orgId);
    const enriched = await Promise.all(memberships.map(async m => {
      const user = await findUserById(m.userId).catch(() => null);
      return {
        ...m,
        user: user ? { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatarUrl: user.avatarUrl } : null,
      };
    }));
    res.json({ data: enriched, total: enriched.length });
  } catch (err) {
    req.log.error({ err }, "List members failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list members." } });
  }
});

const UpdateMemberRoleSchema = z.object({
  orgRole: z.enum(["owner", "admin", "member"]),
});

/**
 * PATCH /v1/organizations/:orgId/members/:userId
 * Update a member's role. Requires users:write.
 */
router.patch("/organizations/:orgId/members/:userId", resolveAuth, requireAuth, requirePermission("users:write"), async (req, res) => {
  const auth = req.auth!;
  const { orgId, userId } = req.params as Record<string, string>;
  const parse = UpdateMemberRoleSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const updated = await updateMemberRole({ memberUserId: userId, organizationId: orgId, newRole: parse.data.orgRole, actorId: auth.userId, actorEmail: auth.email });
    if (!updated) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Membership not found." } });
      return;
    }
    res.json({ membership: updated });
  } catch (err) {
    req.log.error({ err }, "Update member role failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update member role." } });
  }
});

/**
 * DELETE /v1/organizations/:orgId/members/:userId
 * Remove a member from an organization. Requires users:delete.
 */
router.delete("/organizations/:orgId/members/:userId", resolveAuth, requireAuth, requirePermission("users:delete"), async (req, res) => {
  const auth = req.auth!;
  const { orgId, userId } = req.params as Record<string, string>;

  try {
    await removeMember({ memberUserId: userId, organizationId: orgId, actorId: auth.userId, actorEmail: auth.email });
    res.json({ message: "Member removed." });
  } catch (err) {
    req.log.error({ err }, "Remove member failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to remove member." } });
  }
});

export default router;
