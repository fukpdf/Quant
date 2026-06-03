import {
  createInvitation, findInvitationByToken, findPendingInvitation, updateInvitation, listInvitationsByOrg,
  findUserByEmail, findOrganizationById,
} from "./auth-db";
import { generateSecureToken } from "./token-service";
import { addMember } from "./tenant-service";
import { getEmailProvider, buildInvitationEmail } from "./email-provider";
import { auditInvitationSent, auditLog } from "./auth-audit-service";
import { recordSecurityEvent } from "./security-event-service";
import { logger } from "../lib/logger";
import type { Invitation } from "@workspace/db";

/**
 * invitation-service.ts — Email invitation lifecycle.
 * Handles send, accept, decline, and expiry.
 */

export async function sendInvitation(opts: {
  organizationId: string;
  email: string;
  roleToAssign: string;
  invitedBy: string;
  invitedByEmail: string;
}): Promise<Invitation> {
  const org = await findOrganizationById(opts.organizationId);
  if (!org) throw Object.assign(new Error("Organization not found"), { code: "NOT_FOUND" });

  const existing = await findPendingInvitation(opts.organizationId, opts.email);
  if (existing) throw Object.assign(new Error("A pending invitation already exists for this email"), { code: "INVITATION_EXISTS" });

  const token = generateSecureToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invitation = await createInvitation({
    organizationId: opts.organizationId,
    email: opts.email.toLowerCase(),
    roleToAssign: opts.roleToAssign,
    token,
    status: "pending",
    invitedBy: opts.invitedBy,
    expiresAt,
  });

  // Send email (non-fatal)
  try {
    const emailProvider = getEmailProvider();
    const msg = buildInvitationEmail(opts.email, org.name, opts.invitedByEmail, token);
    await emailProvider.send(msg);
  } catch (err) {
    logger.error({ err, invitationId: invitation.id }, "Failed to send invitation email");
  }

  await auditInvitationSent({ actorId: opts.invitedBy, actorEmail: opts.invitedByEmail, inviteeEmail: opts.email, orgId: opts.organizationId, roleName: opts.roleToAssign });
  await recordSecurityEvent({ userId: opts.invitedBy, eventType: "invitation_sent", severity: "info", organizationId: opts.organizationId, details: { inviteeEmail: opts.email } });

  return invitation;
}

export async function acceptInvitation(token: string, acceptingUserId: string, acceptingEmail: string): Promise<void> {
  const invitation = await findInvitationByToken(token);
  if (!invitation) throw Object.assign(new Error("Invitation not found"), { code: "NOT_FOUND" });
  if (invitation.status !== "pending") throw Object.assign(new Error("Invitation is no longer pending"), { code: "INVITATION_INVALID" });
  if (invitation.expiresAt < new Date()) {
    await updateInvitation(invitation.id, { status: "expired" });
    throw Object.assign(new Error("Invitation has expired"), { code: "INVITATION_EXPIRED" });
  }

  // Verify email matches
  if (invitation.email.toLowerCase() !== acceptingEmail.toLowerCase()) {
    throw Object.assign(new Error("This invitation was sent to a different email address"), { code: "EMAIL_MISMATCH" });
  }

  await updateInvitation(invitation.id, { status: "accepted", acceptedBy: acceptingUserId });

  await addMember({
    userId: acceptingUserId,
    organizationId: invitation.organizationId,
    orgRole: invitation.roleToAssign,
    invitedBy: invitation.invitedBy,
    actorId: acceptingUserId,
    actorEmail: acceptingEmail,
  });

  await recordSecurityEvent({ userId: acceptingUserId, eventType: "invitation_accepted", severity: "info", organizationId: invitation.organizationId });
  await auditLog({ actorId: acceptingUserId, actorEmail: acceptingEmail, action: "invitation.accept", resource: "invitation", resourceId: invitation.id, organizationId: invitation.organizationId });
}

export async function declineInvitation(token: string, decliningUserId: string, decliningEmail: string): Promise<void> {
  const invitation = await findInvitationByToken(token);
  if (!invitation) throw Object.assign(new Error("Invitation not found"), { code: "NOT_FOUND" });
  if (invitation.status !== "pending") throw Object.assign(new Error("Invitation is no longer pending"), { code: "INVITATION_INVALID" });
  await updateInvitation(invitation.id, { status: "declined" });
  await recordSecurityEvent({ userId: decliningUserId, eventType: "invitation_declined", severity: "info", organizationId: invitation.organizationId });
}

export async function listOrgInvitations(organizationId: string): Promise<Invitation[]> {
  return listInvitationsByOrg(organizationId);
}

export async function getInvitationByToken(token: string): Promise<Invitation | null> {
  return (await findInvitationByToken(token)) ?? null;
}
