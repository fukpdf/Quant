import { Router, type IRouter } from "express";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { listActiveSessions, revokeUserSession, revokeAllSessions } from "../../services/session-service";
import { auditSessionRevoked } from "../../services/auth-audit-service";
import { recordSecurityEvent } from "../../services/security-event-service";

const router: IRouter = Router();

/**
 * GET /v1/auth/sessions
 * List all active sessions for the authenticated user.
 */
router.get("/auth/sessions", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  try {
    const sessions = await listActiveSessions(auth.userId);
    const safeSession = sessions.map(s => ({
      id: s.id,
      ipAddress: s.ipAddress,
      userAgent: s.userAgent,
      deviceInfo: s.deviceInfo,
      lastActiveAt: s.lastActiveAt,
      expiresAt: s.expiresAt,
      current: s.id === auth.sessionId,
      createdAt: s.createdAt,
    }));
    res.json({ sessions: safeSession, total: safeSession.length });
  } catch (err) {
    req.log.error({ err }, "List sessions failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list sessions." } });
  }
});

/**
 * DELETE /v1/auth/sessions/:sessionId
 * Revoke a specific session.
 */
router.delete("/auth/sessions/:sessionId", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const { sessionId } = req.params as Record<string, string>;
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;

  try {
    const sessions = await listActiveSessions(auth.userId);
    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Session not found." } });
      return;
    }
    await revokeUserSession(sessionId, "user_revoked");
    await auditSessionRevoked({ actorId: auth.userId, actorEmail: auth.email, sessionId, reason: "user_revoked" });
    await recordSecurityEvent({ userId: auth.userId, eventType: "session_revoked", severity: "info", ipAddress });
    res.json({ message: "Session revoked." });
  } catch (err) {
    req.log.error({ err }, "Revoke session failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to revoke session." } });
  }
});

/**
 * DELETE /v1/auth/sessions
 * Revoke ALL sessions for the authenticated user (sign out everywhere).
 */
router.delete("/auth/sessions", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;

  try {
    await revokeAllSessions(auth.userId, "revoke_all_user_action");
    await recordSecurityEvent({ userId: auth.userId, eventType: "session_revoked", severity: "warning", ipAddress, details: { scope: "all_sessions" } });
    res.json({ message: "All sessions revoked." });
  } catch (err) {
    req.log.error({ err }, "Revoke all sessions failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to revoke sessions." } });
  }
});

export default router;
