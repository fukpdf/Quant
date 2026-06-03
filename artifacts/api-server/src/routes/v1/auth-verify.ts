import { Router, type IRouter } from "express";
import { z } from "zod";
import { verifyEmail, resendVerificationEmail } from "../../services/auth-service";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { authRateLimit } from "../../middleware/rate-limit-middleware";

const router: IRouter = Router();

const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

/**
 * POST /v1/auth/verify-email
 * Verify email address using the token from the verification email.
 */
router.post("/auth/verify-email", authRateLimit, async (req, res) => {
  const parse = VerifyEmailSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  try {
    const success = await verifyEmail(parse.data.token);
    if (!success) {
      res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Verification token is invalid or expired." } });
      return;
    }
    res.json({ message: "Email verified successfully." });
  } catch (err) {
    req.log.error({ err }, "Email verification failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Email verification failed." } });
  }
});

/**
 * POST /v1/auth/verify-email/resend
 * Resend the verification email to the authenticated user.
 */
router.post("/auth/verify-email/resend", authRateLimit, resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  try {
    await resendVerificationEmail(auth.userId);
    res.json({ message: "Verification email sent." });
  } catch (err) {
    req.log.error({ err }, "Resend verification email failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to resend verification email." } });
  }
});

export default router;
