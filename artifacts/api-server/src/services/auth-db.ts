import { eq, and, desc, lt, gt, isNull, or, sql, inArray } from "drizzle-orm";
import {
  db,
  usersTable, sessionsTable, refreshTokensTable,
  organizationsTable, teamsTable, membershipsTable, invitationsTable,
  rolesTable, permissionsTable, rolePermissionsTable, userRolesTable,
  securityEventsTable, auditEventsTable,
  userPreferencesTable, userSettingsTable, apiKeysTable,
} from "@workspace/db";
import type {
  User, InsertUser, Session, InsertSession, RefreshToken, InsertRefreshToken,
  Organization, InsertOrganization, Team, InsertTeam, Membership, InsertMembership,
  Invitation, InsertInvitation, Role, InsertRole, Permission, InsertPermission,
  RolePermission, UserRole, InsertUserRole,
  SecurityEvent, InsertSecurityEvent, AuditEvent, InsertAuditEvent,
  UserPreferences, InsertUserPreferences, UserSettings, InsertUserSettings,
  ApiKey, InsertApiKey,
} from "@workspace/db";

/**
 * auth-db.ts — Centralised DB access layer for all Phase 14 auth tables.
 * All Phase 14 services import from this module; they never import tables directly.
 */

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
  return rows[0];
}

export async function findUserById(id: string): Promise<User | undefined> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  return rows[0];
}

export async function findUserByVerificationToken(token: string): Promise<User | undefined> {
  const rows = await db.select().from(usersTable).where(eq(usersTable.emailVerificationToken, token)).limit(1);
  return rows[0];
}

export async function findUserByPasswordResetToken(token: string): Promise<User | undefined> {
  const rows = await db.select().from(usersTable)
    .where(and(
      eq(usersTable.passwordResetToken, token),
      gt(usersTable.passwordResetExpiresAt, new Date()),
    ))
    .limit(1);
  return rows[0];
}

export async function createUser(data: InsertUser): Promise<User> {
  const normalised = { ...data, email: data.email.toLowerCase() };
  const rows = await db.insert(usersTable).values(normalised).returning();
  return rows[0]!;
}

export async function updateUser(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User | undefined> {
  const rows = await db.update(usersTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning();
  return rows[0];
}

export async function listUsers(opts?: { activeOnly?: boolean; limit?: number; offset?: number }): Promise<User[]> {
  const conditions = opts?.activeOnly ? [eq(usersTable.isActive, true)] : [];
  const query = db.select().from(usersTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(usersTable.createdAt))
    .limit(opts?.limit ?? 100)
    .offset(opts?.offset ?? 0);
  return query;
}

export async function incrementFailedLoginAttempts(userId: string): Promise<void> {
  await db.update(usersTable)
    .set({
      failedLoginAttempts: sql`${usersTable.failedLoginAttempts} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));
}

export async function resetFailedLoginAttempts(userId: string): Promise<void> {
  await db.update(usersTable)
    .set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}

export async function lockUserAccount(userId: string, until: Date): Promise<void> {
  await db.update(usersTable)
    .set({ lockedUntil: until, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function createSession(data: InsertSession): Promise<Session> {
  const rows = await db.insert(sessionsTable).values(data).returning();
  return rows[0]!;
}

export async function findSessionById(id: string): Promise<Session | undefined> {
  const rows = await db.select().from(sessionsTable).where(eq(sessionsTable.id, id)).limit(1);
  return rows[0];
}

export async function findActiveSessionsByUser(userId: string): Promise<Session[]> {
  return db.select().from(sessionsTable)
    .where(and(
      eq(sessionsTable.userId, userId),
      eq(sessionsTable.isRevoked, false),
      gt(sessionsTable.expiresAt, new Date()),
    ))
    .orderBy(desc(sessionsTable.lastActiveAt));
}

export async function updateSessionLastActive(id: string, tokenHash: string): Promise<void> {
  await db.update(sessionsTable)
    .set({ lastActiveAt: new Date(), tokenHash })
    .where(eq(sessionsTable.id, id));
}

export async function revokeSession(id: string, reason?: string): Promise<void> {
  await db.update(sessionsTable)
    .set({ isRevoked: true, revokedAt: new Date(), revokedReason: reason ?? "explicit_logout" })
    .where(eq(sessionsTable.id, id));
}

export async function revokeAllUserSessions(userId: string, reason?: string): Promise<void> {
  await db.update(sessionsTable)
    .set({ isRevoked: true, revokedAt: new Date(), revokedReason: reason ?? "revoke_all" })
    .where(and(eq(sessionsTable.userId, userId), eq(sessionsTable.isRevoked, false)));
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

export async function createRefreshToken(data: InsertRefreshToken): Promise<RefreshToken> {
  const rows = await db.insert(refreshTokensTable).values(data).returning();
  return rows[0]!;
}

export async function findRefreshTokenByHash(hash: string): Promise<RefreshToken | undefined> {
  const rows = await db.select().from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, hash))
    .limit(1);
  return rows[0];
}

export async function revokeRefreshToken(id: string, replacedById?: string): Promise<void> {
  await db.update(refreshTokensTable)
    .set({ isRevoked: true, revokedAt: new Date(), replacedByTokenId: replacedById ?? null })
    .where(eq(refreshTokensTable.id, id));
}

export async function revokeRefreshTokenFamily(family: string): Promise<void> {
  await db.update(refreshTokensTable)
    .set({ isRevoked: true, revokedAt: new Date() })
    .where(and(eq(refreshTokensTable.family, family), eq(refreshTokensTable.isRevoked, false)));
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export async function createOrganization(data: InsertOrganization): Promise<Organization> {
  const rows = await db.insert(organizationsTable).values(data).returning();
  return rows[0]!;
}

export async function findOrganizationById(id: string): Promise<Organization | undefined> {
  const rows = await db.select().from(organizationsTable).where(eq(organizationsTable.id, id)).limit(1);
  return rows[0];
}

export async function findOrganizationBySlug(slug: string): Promise<Organization | undefined> {
  const rows = await db.select().from(organizationsTable).where(eq(organizationsTable.slug, slug)).limit(1);
  return rows[0];
}

export async function updateOrganization(id: string, data: Partial<Omit<Organization, "id" | "createdAt">>): Promise<Organization | undefined> {
  const rows = await db.update(organizationsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(organizationsTable.id, id))
    .returning();
  return rows[0];
}

export async function listOrganizations(opts?: { activeOnly?: boolean }): Promise<Organization[]> {
  const conditions = opts?.activeOnly ? [eq(organizationsTable.isActive, true)] : [];
  return db.select().from(organizationsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(organizationsTable.createdAt));
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export async function createTeam(data: InsertTeam): Promise<Team> {
  const rows = await db.insert(teamsTable).values(data).returning();
  return rows[0]!;
}

export async function findTeamById(id: string): Promise<Team | undefined> {
  const rows = await db.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
  return rows[0];
}

export async function listTeamsByOrg(organizationId: string): Promise<Team[]> {
  return db.select().from(teamsTable)
    .where(and(eq(teamsTable.organizationId, organizationId), eq(teamsTable.isActive, true)))
    .orderBy(teamsTable.name);
}

export async function updateTeam(id: string, data: Partial<Omit<Team, "id" | "createdAt">>): Promise<Team | undefined> {
  const rows = await db.update(teamsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(teamsTable.id, id))
    .returning();
  return rows[0];
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

export async function createMembership(data: InsertMembership): Promise<Membership> {
  const rows = await db.insert(membershipsTable).values(data).returning();
  return rows[0]!;
}

export async function findMembership(userId: string, organizationId: string): Promise<Membership | undefined> {
  const rows = await db.select().from(membershipsTable)
    .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.organizationId, organizationId)))
    .limit(1);
  return rows[0];
}

export async function listMembershipsByUser(userId: string): Promise<Membership[]> {
  return db.select().from(membershipsTable)
    .where(and(eq(membershipsTable.userId, userId), eq(membershipsTable.isActive, true)));
}

export async function listMembershipsByOrg(organizationId: string): Promise<Membership[]> {
  return db.select().from(membershipsTable)
    .where(and(eq(membershipsTable.organizationId, organizationId), eq(membershipsTable.isActive, true)));
}

export async function updateMembership(id: string, data: Partial<Omit<Membership, "id" | "createdAt">>): Promise<Membership | undefined> {
  const rows = await db.update(membershipsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(membershipsTable.id, id))
    .returning();
  return rows[0];
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export async function createInvitation(data: InsertInvitation): Promise<Invitation> {
  const rows = await db.insert(invitationsTable).values(data).returning();
  return rows[0]!;
}

export async function findInvitationByToken(token: string): Promise<Invitation | undefined> {
  const rows = await db.select().from(invitationsTable).where(eq(invitationsTable.token, token)).limit(1);
  return rows[0];
}

export async function findPendingInvitation(organizationId: string, email: string): Promise<Invitation | undefined> {
  const rows = await db.select().from(invitationsTable)
    .where(and(
      eq(invitationsTable.organizationId, organizationId),
      eq(invitationsTable.email, email.toLowerCase()),
      eq(invitationsTable.status, "pending"),
      gt(invitationsTable.expiresAt, new Date()),
    ))
    .limit(1);
  return rows[0];
}

export async function updateInvitation(id: string, data: Partial<Omit<Invitation, "id" | "createdAt">>): Promise<Invitation | undefined> {
  const rows = await db.update(invitationsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(invitationsTable.id, id))
    .returning();
  return rows[0];
}

export async function listInvitationsByOrg(organizationId: string): Promise<Invitation[]> {
  return db.select().from(invitationsTable)
    .where(eq(invitationsTable.organizationId, organizationId))
    .orderBy(desc(invitationsTable.createdAt));
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export async function listRoles(): Promise<Role[]> {
  return db.select().from(rolesTable).where(eq(rolesTable.isActive, true)).orderBy(rolesTable.name);
}

export async function findRoleByName(name: string): Promise<Role | undefined> {
  const rows = await db.select().from(rolesTable).where(eq(rolesTable.name, name)).limit(1);
  return rows[0];
}

export async function findRoleById(id: string): Promise<Role | undefined> {
  const rows = await db.select().from(rolesTable).where(eq(rolesTable.id, id)).limit(1);
  return rows[0];
}

export async function upsertRole(data: InsertRole & { name: string }): Promise<Role> {
  const rows = await db.insert(rolesTable).values(data)
    .onConflictDoUpdate({ target: rolesTable.name, set: { description: data.description, updatedAt: new Date() } })
    .returning();
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

export async function listPermissions(): Promise<Permission[]> {
  return db.select().from(permissionsTable).orderBy(permissionsTable.resource, permissionsTable.action);
}

export async function findPermissionByName(name: string): Promise<Permission | undefined> {
  const rows = await db.select().from(permissionsTable).where(eq(permissionsTable.name, name)).limit(1);
  return rows[0];
}

export async function upsertPermission(data: InsertPermission & { name: string }): Promise<Permission> {
  const rows = await db.insert(permissionsTable).values(data)
    .onConflictDoUpdate({ target: permissionsTable.name, set: { description: data.description } })
    .returning();
  return rows[0]!;
}

export async function getPermissionsForRole(roleId: string): Promise<Permission[]> {
  const rps = await db.select({ permissionId: rolePermissionsTable.permissionId })
    .from(rolePermissionsTable)
    .where(eq(rolePermissionsTable.roleId, roleId));
  if (rps.length === 0) return [];
  const ids = rps.map(r => r.permissionId);
  return db.select().from(permissionsTable).where(sql`${permissionsTable.id} = ANY(${ids}::uuid[])`);
}

export async function setRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  await db.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId));
  if (permissionIds.length > 0) {
    await db.insert(rolePermissionsTable).values(permissionIds.map(pid => ({ roleId, permissionId: pid })));
  }
}

// ---------------------------------------------------------------------------
// User roles
// ---------------------------------------------------------------------------

export async function assignUserRole(data: InsertUserRole): Promise<UserRole> {
  const rows = await db.insert(userRolesTable).values(data).returning();
  return rows[0]!;
}

export async function listUserRoles(userId: string, organizationId?: string | null): Promise<UserRole[]> {
  const conditions = [eq(userRolesTable.userId, userId)];
  if (organizationId !== undefined) {
    conditions.push(organizationId === null ? isNull(userRolesTable.organizationId) : eq(userRolesTable.organizationId, organizationId));
  }
  return db.select().from(userRolesTable).where(and(...conditions));
}

export async function removeUserRole(id: string): Promise<void> {
  await db.delete(userRolesTable).where(eq(userRolesTable.id, id));
}

export async function getEffectivePermissionsForUser(userId: string, organizationId?: string | null): Promise<string[]> {
  const roleRows = await listUserRoles(userId);
  const orgRoleRows = organizationId ? await listUserRoles(userId, organizationId) : [];
  const allRoles = [...roleRows, ...orgRoleRows];
  if (allRoles.length === 0) return [];
  const roleIds = [...new Set(allRoles.map(r => r.roleId))];
  if (roleIds.length === 0) return [];
  const permRows = await db.select({ name: permissionsTable.name })
    .from(rolePermissionsTable)
    .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
    .where(inArray(rolePermissionsTable.roleId, roleIds));
  return [...new Set(permRows.map(p => p.name))];
}

// ---------------------------------------------------------------------------
// Security events
// ---------------------------------------------------------------------------

export async function insertSecurityEvent(data: InsertSecurityEvent): Promise<SecurityEvent> {
  const rows = await db.insert(securityEventsTable).values(data).returning();
  return rows[0]!;
}

export async function listSecurityEvents(opts?: {
  userId?: string;
  eventType?: string;
  severity?: string;
  limit?: number;
  offset?: number;
}): Promise<SecurityEvent[]> {
  const conditions = [];
  if (opts?.userId) conditions.push(eq(securityEventsTable.userId, opts.userId));
  if (opts?.eventType) conditions.push(eq(securityEventsTable.eventType, opts.eventType));
  if (opts?.severity) conditions.push(eq(securityEventsTable.severity, opts.severity));
  return db.select().from(securityEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(securityEventsTable.createdAt))
    .limit(opts?.limit ?? 100)
    .offset(opts?.offset ?? 0);
}

export async function countRecentFailedLogins(email: string, windowMinutes: number): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);
  const rows = await db.select({ count: sql<number>`count(*)` })
    .from(securityEventsTable)
    .where(and(
      eq(securityEventsTable.eventType, "login_failure"),
      gt(securityEventsTable.createdAt, since),
      sql`${securityEventsTable.details}->>'email' = ${email.toLowerCase()}`,
    ));
  return Number(rows[0]?.count ?? 0);
}

// ---------------------------------------------------------------------------
// Audit events
// ---------------------------------------------------------------------------

export async function insertAuditEvent(data: InsertAuditEvent): Promise<AuditEvent> {
  const rows = await db.insert(auditEventsTable).values(data).returning();
  return rows[0]!;
}

export async function listAuditEvents(opts?: {
  actorId?: string;
  resource?: string;
  action?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
}): Promise<AuditEvent[]> {
  const conditions = [];
  if (opts?.actorId) conditions.push(eq(auditEventsTable.actorId, opts.actorId));
  if (opts?.resource) conditions.push(eq(auditEventsTable.resource, opts.resource));
  if (opts?.action) conditions.push(eq(auditEventsTable.action, opts.action));
  if (opts?.organizationId) conditions.push(eq(auditEventsTable.organizationId, opts.organizationId));
  return db.select().from(auditEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEventsTable.createdAt))
    .limit(opts?.limit ?? 100)
    .offset(opts?.offset ?? 0);
}

// ---------------------------------------------------------------------------
// User preferences
// ---------------------------------------------------------------------------

export async function findUserPreferences(userId: string): Promise<UserPreferences | undefined> {
  const rows = await db.select().from(userPreferencesTable).where(eq(userPreferencesTable.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertUserPreferences(userId: string, data: Partial<InsertUserPreferences>): Promise<UserPreferences> {
  const rows = await db.insert(userPreferencesTable)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: userPreferencesTable.userId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// User settings
// ---------------------------------------------------------------------------

export async function findUserSettings(userId: string): Promise<UserSettings | undefined> {
  const rows = await db.select().from(userSettingsTable).where(eq(userSettingsTable.userId, userId)).limit(1);
  return rows[0];
}

export async function upsertUserSettings(userId: string, data: Partial<InsertUserSettings>): Promise<UserSettings> {
  const rows = await db.insert(userSettingsTable)
    .values({ userId, ...data })
    .onConflictDoUpdate({
      target: userSettingsTable.userId,
      set: { ...data, updatedAt: new Date() },
    })
    .returning();
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// API keys
// ---------------------------------------------------------------------------

export async function createApiKey(data: InsertApiKey): Promise<ApiKey> {
  const rows = await db.insert(apiKeysTable).values(data).returning();
  return rows[0]!;
}

export async function findApiKeyByHash(keyHash: string): Promise<ApiKey | undefined> {
  const rows = await db.select().from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, keyHash), eq(apiKeysTable.isRevoked, false)))
    .limit(1);
  return rows[0];
}

export async function listApiKeysByUser(userId: string): Promise<ApiKey[]> {
  return db.select().from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId))
    .orderBy(desc(apiKeysTable.createdAt));
}

export async function revokeApiKey(id: string, reason?: string): Promise<void> {
  await db.update(apiKeysTable)
    .set({ isRevoked: true, revokedAt: new Date(), revokedReason: reason ?? null, updatedAt: new Date() })
    .where(eq(apiKeysTable.id, id));
}

export async function updateApiKeyLastUsed(id: string): Promise<void> {
  await db.update(apiKeysTable).set({ lastUsedAt: new Date() }).where(eq(apiKeysTable.id, id));
}
