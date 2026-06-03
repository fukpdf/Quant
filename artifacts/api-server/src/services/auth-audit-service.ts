import { insertAuditEvent } from "./auth-db";
import { logger } from "../lib/logger";

/**
 * auth-audit-service.ts — Immutable audit trail for all user-initiated auth actions.
 *
 * All writes are append-only. Errors are caught and logged but never surface to callers,
 * so audit failures never interrupt the primary auth flow.
 */

interface AuditInput {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  organizationId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function auditLog(input: AuditInput): Promise<void> {
  try {
    await insertAuditEvent({
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? null,
      action: input.action,
      resource: input.resource,
      resourceId: input.resourceId ?? null,
      organizationId: input.organizationId ?? null,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, action: input.action, resource: input.resource }, "Failed to write audit log entry");
  }
}

// Convenience wrappers for common auth audit events

export async function auditUserLogin(opts: { actorId: string; actorEmail: string; ipAddress?: string | null; userAgent?: string | null }): Promise<void> {
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "user.login", resource: "session", ipAddress: opts.ipAddress, userAgent: opts.userAgent });
}

export async function auditUserLogout(opts: { actorId: string; actorEmail: string; sessionId: string; ipAddress?: string | null }): Promise<void> {
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "user.logout", resource: "session", resourceId: opts.sessionId, ipAddress: opts.ipAddress });
}

export async function auditUserRegister(opts: { actorId: string; actorEmail: string; ipAddress?: string | null }): Promise<void> {
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "user.register", resource: "user", resourceId: opts.actorId, ipAddress: opts.ipAddress });
}

export async function auditPasswordChange(opts: { actorId: string; actorEmail: string; ipAddress?: string | null }): Promise<void> {
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "password.change", resource: "user", resourceId: opts.actorId, ipAddress: opts.ipAddress });
}

export async function auditPasswordReset(opts: { email: string; ipAddress?: string | null }): Promise<void> {
  await auditLog({ actorEmail: opts.email, action: "password.reset_complete", resource: "user", ipAddress: opts.ipAddress });
}

export async function auditRoleAssigned(opts: { actorId: string; actorEmail: string; targetUserId: string; roleName: string; organizationId?: string | null }): Promise<void> {
  await auditLog({
    actorId: opts.actorId,
    actorEmail: opts.actorEmail,
    action: "role.assign",
    resource: "user_role",
    resourceId: opts.targetUserId,
    organizationId: opts.organizationId,
    metadata: { roleName: opts.roleName },
  });
}

export async function auditOrgCreated(opts: { actorId: string; actorEmail: string; orgId: string; orgName: string }): Promise<void> {
  await auditLog({
    actorId: opts.actorId,
    actorEmail: opts.actorEmail,
    action: "organization.create",
    resource: "organization",
    resourceId: opts.orgId,
    afterState: { name: opts.orgName },
  });
}

export async function auditInvitationSent(opts: { actorId: string; actorEmail: string; inviteeEmail: string; orgId: string; roleName: string }): Promise<void> {
  await auditLog({
    actorId: opts.actorId,
    actorEmail: opts.actorEmail,
    action: "invitation.send",
    resource: "invitation",
    organizationId: opts.orgId,
    metadata: { inviteeEmail: opts.inviteeEmail, roleName: opts.roleName },
  });
}

export async function auditSessionRevoked(opts: { actorId: string; actorEmail: string; sessionId: string; reason?: string }): Promise<void> {
  await auditLog({
    actorId: opts.actorId,
    actorEmail: opts.actorEmail,
    action: "session.revoke",
    resource: "session",
    resourceId: opts.sessionId,
    metadata: { reason: opts.reason },
  });
}
