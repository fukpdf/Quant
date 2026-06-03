import { Router, type IRouter } from "express";
import { z } from "zod";
import { login, logout } from "../../services/auth-service";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { authRateLimit } from "../../middleware/rate-limit-middleware";

const router: IRouter = Router();

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(false),
});

/**
 * POST /v1/auth/login
 * Authenticate with email + password. Returns access + refresh tokens.
 */
router.post("/auth/login", authRateLimit, async (req, res) => {
  const parse = LoginSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;
  const userAgent = req.headers["user-agent"] ?? undefined;

  try {
    const result = await login({ ...parse.data, ipAddress, userAgent });
    res.json({
      user: result.user,
      tokens: result.tokens,
      organizationId: result.organizationId,
    });
  } catch (err: any) {
    const code = err?.code;
    if (code === "INVALID_CREDENTIALS") {
      res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } });
      return;
    }
    if (code === "ACCOUNT_LOCKED") {
      res.status(423).json({ error: { code: "ACCOUNT_LOCKED", message: err.message } });
      return;
    }
    if (code === "ACCOUNT_INACTIVE") {
      res.status(403).json({ error: { code: "ACCOUNT_INACTIVE", message: "Account is deactivated." } });
      return;
    }
    req.log.error({ err }, "Login failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Login failed." } });
  }
});

/**
 * POST /v1/auth/logout
 * Revoke the current session.
 */
router.post("/auth/logout", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;
  try {
    await logout(auth.sessionId, auth.userId, auth.email, ipAddress);
    res.json({ message: "Logged out successfully." });
  } catch (err) {
    req.log.error({ err }, "Logout failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Logout failed." } });
  }
});

export default router;
