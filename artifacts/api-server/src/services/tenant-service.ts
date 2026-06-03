import {
  createOrganization, findOrganizationById, findOrganizationBySlug, updateOrganization, listOrganizations,
  createTeam, findTeamById, listTeamsByOrg, updateTeam,
  createMembership, findMembership, listMembershipsByUser, listMembershipsByOrg, updateMembership,
} from "./auth-db";
import { assignRole } from "./rbac-service";
import { auditOrgCreated, auditLog } from "./auth-audit-service";
import type { Organization, Team, Membership } from "@workspace/db";
import type { RoleName } from "./auth-types";

/**
 * tenant-service.ts — Organization, team, and membership lifecycle management.
 *
 * All org-scoped operations validate membership before performing changes.
 */

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export async function createOrg(opts: {
  name: string;
  slug?: string;
  description?: string;
  createdBy: string;
  createdByEmail: string;
}): Promise<Organization> {
  const slug = opts.slug ?? generateSlug(opts.name);
  const existing = await findOrganizationBySlug(slug);
  if (existing) {
    throw Object.assign(new Error(`Organization slug already taken: ${slug}`), { code: "SLUG_TAKEN" });
  }

  const org = await createOrganization({
    name: opts.name,
    slug,
    description: opts.description ?? null,
    createdBy: opts.createdBy,
    isActive: true,
    maxMembers: 5,
    plan: "free",
  });

  // Add creator as owner
  await createMembership({ userId: opts.createdBy, organizationId: org.id, orgRole: "owner", isActive: true, invitedBy: null });
  await assignRole({ userId: opts.createdBy, roleName: "org_owner", organizationId: org.id });
  await auditOrgCreated({ actorId: opts.createdBy, actorEmail: opts.createdByEmail, orgId: org.id, orgName: org.name });

  return org;
}

export async function getOrgById(id: string): Promise<Organization | null> {
  return (await findOrganizationById(id)) ?? null;
}

export async function getOrgBySlug(slug: string): Promise<Organization | null> {
  return (await findOrganizationBySlug(slug)) ?? null;
}

export async function updateOrg(id: string, data: { name?: string; description?: string; settings?: Record<string, unknown> | null }, actorId: string, actorEmail: string): Promise<Organization | null> {
  const existing = await findOrganizationById(id);
  if (!existing) return null;
  const updated = await updateOrganization(id, data);
  await auditLog({ actorId, actorEmail, action: "organization.update", resource: "organization", resourceId: id, beforeState: { name: existing.name }, afterState: data });
  return updated ?? null;
}

export async function listOrgs(activeOnly = true): Promise<Organization[]> {
  return listOrganizations({ activeOnly });
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function createOrgTeam(opts: {
  organizationId: string;
  name: string;
  description?: string;
  createdBy: string;
  createdByEmail: string;
}): Promise<Team> {
  const team = await createTeam({
    organizationId: opts.organizationId,
    name: opts.name,
    description: opts.description ?? null,
    createdBy: opts.createdBy,
    isActive: true,
  });
  await auditLog({ actorId: opts.createdBy, actorEmail: opts.createdByEmail, action: "team.create", resource: "team", resourceId: team.id, organizationId: opts.organizationId });
  return team;
}

export async function getTeamById(id: string): Promise<Team | null> {
  return (await findTeamById(id)) ?? null;
}

export async function listOrgTeams(organizationId: string): Promise<Team[]> {
  return listTeamsByOrg(organizationId);
}

export async function updateOrgTeam(id: string, data: { name?: string; description?: string }, actorId: string, actorEmail: string): Promise<Team | null> {
  const updated = await updateTeam(id, data);
  if (!updated) return null;
  await auditLog({ actorId, actorEmail, action: "team.update", resource: "team", resourceId: id, afterState: data });
  return updated;
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export async function getUserOrgs(userId: string): Promise<Membership[]> {
  return listMembershipsByUser(userId);
}

export async function getOrgMembers(organizationId: string): Promise<Membership[]> {
  return listMembershipsByOrg(organizationId);
}

export async function addMember(opts: {
  userId: string;
  organizationId: string;
  orgRole: string;
  invitedBy: string | null;
  actorId: string;
  actorEmail: string;
}): Promise<Membership> {
  const existing = await findMembership(opts.userId, opts.organizationId);
  if (existing?.isActive) {
    throw Object.assign(new Error("User is already a member of this organization"), { code: "ALREADY_MEMBER" });
  }

  if (existing) {
    const updated = await updateMembership(existing.id, { isActive: true, orgRole: opts.orgRole });
    return updated!;
  }

  const membership = await createMembership({
    userId: opts.userId,
    organizationId: opts.organizationId,
    orgRole: opts.orgRole,
    isActive: true,
    invitedBy: opts.invitedBy,
  });

  await assignRole({ userId: opts.userId, roleName: opts.orgRole as RoleName, organizationId: opts.organizationId, grantedBy: opts.actorId });
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "member.add", resource: "membership", resourceId: membership.id, organizationId: opts.organizationId });

  return membership;
}

export async function removeMember(opts: {
  memberUserId: string;
  organizationId: string;
  actorId: string;
  actorEmail: string;
}): Promise<void> {
  const existing = await findMembership(opts.memberUserId, opts.organizationId);
  if (!existing) return;
  await updateMembership(existing.id, { isActive: false });
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "member.remove", resource: "membership", resourceId: existing.id, organizationId: opts.organizationId });
}

export async function updateMemberRole(opts: {
  memberUserId: string;
  organizationId: string;
  newRole: string;
  actorId: string;
  actorEmail: string;
}): Promise<Membership | null> {
  const existing = await findMembership(opts.memberUserId, opts.organizationId);
  if (!existing) return null;
  const updated = await updateMembership(existing.id, { orgRole: opts.newRole });
  await auditLog({ actorId: opts.actorId, actorEmail: opts.actorEmail, action: "member.update_role", resource: "membership", resourceId: existing.id, organizationId: opts.organizationId, afterState: { orgRole: opts.newRole } });
  return updated ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateSlug(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 40)
    + "-" + Math.random().toString(36).substring(2, 7);
}
