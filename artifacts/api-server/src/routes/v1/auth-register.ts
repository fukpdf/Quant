import { Router, type IRouter } from "express";
import { z } from "zod";
import { register } from "../../services/auth-service";
import { authRateLimit } from "../../middleware/rate-limit-middleware";

const router: IRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  organizationName: z.string().min(1).max(100).optional(),
});

/**
 * POST /v1/auth/register
 * Create a new user account. Returns tokens on success.
 */
router.post("/auth/register", authRateLimit, async (req, res) => {
  const parse = RegisterSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? null;
  const userAgent = req.headers["user-agent"] ?? null;

  try {
    const result = await register(parse.data, ipAddress ?? undefined, userAgent ?? undefined);
    res.status(201).json({
      user: result.user,
      tokens: result.tokens,
    });
  } catch (err: any) {
    if (err?.code === "EMAIL_TAKEN") {
      res.status(409).json({ error: { code: "EMAIL_TAKEN", message: "This email address is already registered." } });
      return;
    }
    req.log.error({ err }, "Registration failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Registration failed." } });
  }
});

export default router;
