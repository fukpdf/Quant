import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { findUserById, updateUser, findUserPreferences, findUserSettings, upsertUserPreferences, upsertUserSettings } from "../../services/auth-db";
import { toSafeUser } from "../../services/auth-service";
import { getUserRoleNames, getUserEffectivePermissions } from "../../services/rbac-service";
import { listMembershipsByUser } from "../../services/auth-db";
import { auditLog } from "../../services/auth-audit-service";

const router: IRouter = Router();

/**
 * GET /v1/auth/me
 * Return the authenticated user's profile, roles, permissions, and org memberships.
 */
router.get("/auth/me", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  try {
    const user = await findUserById(auth.userId);
    if (!user) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }
    const roles = await getUserRoleNames(user.id, auth.organizationId ?? undefined);
    const permissions = await getUserEffectivePermissions(user.id, auth.organizationId ?? undefined);
    const memberships = await listMembershipsByUser(user.id);
    const preferences = await findUserPreferences(user.id);
    const settings = await findUserSettings(user.id);

    res.json({
      user: toSafeUser(user),
      roles,
      permissions,
      memberships,
      preferences,
      settings: settings ? {
        twoFactorEnabled: settings.twoFactorEnabled,
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        allowMultipleSessions: settings.allowMultipleSessions,
        maxSessions: settings.maxSessions,
        emailNotificationsEnabled: settings.emailNotificationsEnabled,
        apiAccessEnabled: settings.apiAccessEnabled,
      } : null,
    });
  } catch (err) {
    req.log.error({ err }, "GET /auth/me failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to fetch profile." } });
  }
});

const UpdateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
});

/**
 * PATCH /v1/auth/me
 * Update authenticated user's own profile.
 */
router.patch("/auth/me", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const parse = UpdateProfileSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const updated = await updateUser(auth.userId, parse.data);
    if (!updated) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }
    await auditLog({ actorId: auth.userId, actorEmail: auth.email, action: "user.update_profile", resource: "user", resourceId: auth.userId, afterState: parse.data });
    res.json({ user: toSafeUser(updated) });
  } catch (err) {
    req.log.error({ err }, "PATCH /auth/me failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update profile." } });
  }
});

const UpdatePreferencesSchema = z.object({
  theme: z.enum(["dark", "light", "system"]).optional(),
  language: z.string().max(10).optional(),
  timezone: z.string().max(50).optional(),
  dateFormat: z.string().max(20).optional(),
  notifications: z.record(z.boolean()).optional(),
  dashboardLayout: z.record(z.unknown()).optional().nullable(),
  defaultOrganizationId: z.string().uuid().optional().nullable(),
});

/**
 * PATCH /v1/auth/me/preferences
 * Update authenticated user's preferences.
 */
router.patch("/auth/me/preferences", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const parse = UpdatePreferencesSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const prefs = await upsertUserPreferences(auth.userId, parse.data);
    res.json({ preferences: prefs });
  } catch (err) {
    req.log.error({ err }, "PATCH /auth/me/preferences failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update preferences." } });
  }
});

export default router;
