import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { sendInvitation, acceptInvitation, declineInvitation, listOrgInvitations, getInvitationByToken } from "../../services/invitation-service";

const router: IRouter = Router();

const SendInvitationSchema = z.object({
  email: z.string().email(),
  roleToAssign: z.enum(["owner", "admin", "member"]).default("member"),
});

/**
 * POST /v1/organizations/:orgId/invitations
 * Send an invitation to join an organization. Requires users:write.
 */
router.post("/organizations/:orgId/invitations", resolveAuth, requireAuth, requirePermission("users:write"), async (req, res) => {
  const auth = req.auth!;
  const { orgId } = req.params as Record<string, string>;
  const parse = SendInvitationSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const invitation = await sendInvitation({ organizationId: orgId, email: parse.data.email, roleToAssign: parse.data.roleToAssign, invitedBy: auth.userId, invitedByEmail: auth.email });
    res.status(201).json({ invitation });
  } catch (err: any) {
    if (err?.code === "NOT_FOUND") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Organization not found." } });
      return;
    }
    if (err?.code === "INVITATION_EXISTS") {
      res.status(409).json({ error: { code: "INVITATION_EXISTS", message: "A pending invitation already exists for this email." } });
      return;
    }
    req.log.error({ err }, "Send invitation failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to send invitation." } });
  }
});

/**
 * GET /v1/organizations/:orgId/invitations
 * List all invitations for an organization. Requires users:read.
 */
router.get("/organizations/:orgId/invitations", resolveAuth, requireAuth, requirePermission("users:read"), async (req, res) => {
  const { orgId } = req.params as Record<string, string>;
  try {
    const invitations = await listOrgInvitations(orgId);
    res.json({ data: invitations, total: invitations.length });
  } catch (err) {
    req.log.error({ err }, "List invitations failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list invitations." } });
  }
});

/**
 * GET /v1/invitations/:token
 * Look up an invitation by token (public — for the invitation acceptance page).
 */
router.get("/invitations/:token", async (req, res) => {
  const { token } = req.params as Record<string, string>;
  try {
    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Invitation not found." } });
      return;
    }
    // Return safe subset — don't expose invitedBy user details
    res.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        roleToAssign: invitation.roleToAssign,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        organizationId: invitation.organizationId,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Get invitation failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to get invitation." } });
  }
});

/**
 * POST /v1/invitations/:token/accept
 * Accept an invitation. User must be authenticated.
 */
router.post("/invitations/:token/accept", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const { token } = req.params as Record<string, string>;
  try {
    await acceptInvitation(token, auth.userId, auth.email);
    res.json({ message: "Invitation accepted. You are now a member." });
  } catch (err: any) {
    const code = err?.code;
    if (code === "NOT_FOUND") { res.status(404).json({ error: { code, message: "Invitation not found." } }); return; }
    if (code === "INVITATION_INVALID") { res.status(400).json({ error: { code, message: "Invitation is no longer valid." } }); return; }
    if (code === "INVITATION_EXPIRED") { res.status(410).json({ error: { code, message: "Invitation has expired." } }); return; }
    if (code === "EMAIL_MISMATCH") { res.status(403).json({ error: { code, message: "This invitation was sent to a different email." } }); return; }
    if (code === "ALREADY_MEMBER") { res.status(409).json({ error: { code, message: "You are already a member of this organization." } }); return; }
    req.log.error({ err }, "Accept invitation failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to accept invitation." } });
  }
});

/**
 * POST /v1/invitations/:token/decline
 * Decline an invitation. User must be authenticated.
 */
router.post("/invitations/:token/decline", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const { token } = req.params as Record<string, string>;
  try {
    await declineInvitation(token, auth.userId, auth.email);
    res.json({ message: "Invitation declined." });
  } catch (err: any) {
    const code = err?.code;
    if (code === "NOT_FOUND") { res.status(404).json({ error: { code, message: "Invitation not found." } }); return; }
    if (code === "INVITATION_INVALID") { res.status(400).json({ error: { code, message: "Invitation is no longer pending." } }); return; }
    req.log.error({ err }, "Decline invitation failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to decline invitation." } });
  }
});

export default router;
