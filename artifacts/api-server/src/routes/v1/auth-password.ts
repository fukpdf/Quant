import { Router, type IRouter } from "express";
import { z } from "zod";
import { forgotPassword, resetPassword, changePassword } from "../../services/auth-service";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { authRateLimit, strictRateLimit } from "../../middleware/rate-limit-middleware";

const router: IRouter = Router();

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

/**
 * POST /v1/auth/password/forgot
 * Request a password reset email. Always responds 200 to prevent email enumeration.
 */
router.post("/auth/password/forgot", strictRateLimit, async (req, res) => {
  const parse = ForgotPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;

  try {
    await forgotPassword(parse.data.email, ipAddress);
    // Always 200 — don't reveal if email exists
    res.json({ message: "If that email is registered, you will receive a password reset link shortly." });
  } catch (err) {
    req.log.error({ err }, "Forgot password failed");
    res.json({ message: "If that email is registered, you will receive a password reset link shortly." });
  }
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

/**
 * POST /v1/auth/password/reset
 * Complete a password reset using the token from the reset email.
 */
router.post("/auth/password/reset", strictRateLimit, async (req, res) => {
  const parse = ResetPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;

  try {
    const success = await resetPassword(parse.data.token, parse.data.newPassword, ipAddress);
    if (!success) {
      res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Reset token is invalid or expired." } });
      return;
    }
    res.json({ message: "Password reset successfully. Please log in with your new password." });
  } catch (err) {
    req.log.error({ err }, "Password reset failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Password reset failed." } });
  }
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

/**
 * POST /v1/auth/password/change
 * Change password while authenticated (requires current password).
 */
router.post("/auth/password/change", authRateLimit, resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const parse = ChangePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;

  try {
    await changePassword(auth.userId, parse.data.currentPassword, parse.data.newPassword, ipAddress);
    res.json({ message: "Password changed successfully." });
  } catch (err: any) {
    if (err?.code === "INVALID_CREDENTIALS") {
      res.status(400).json({ error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect." } });
      return;
    }
    req.log.error({ err }, "Change password failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Password change failed." } });
  }
});

export default router;
