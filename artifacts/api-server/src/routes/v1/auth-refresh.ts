import { Router, type IRouter } from "express";
import { z } from "zod";
import { refreshTokens } from "../../services/auth-service";
import { authRateLimit } from "../../middleware/rate-limit-middleware";

const router: IRouter = Router();

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/**
 * POST /v1/auth/refresh
 * Rotate a refresh token — returns a new access token + refresh token pair.
 * The old refresh token is immediately invalidated (rotation).
 */
router.post("/auth/refresh", authRateLimit, async (req, res) => {
  const parse = RefreshSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] ?? req.ip ?? undefined;

  try {
    const tokens = await refreshTokens(parse.data.refreshToken, ipAddress);
    if (!tokens) {
      res.status(401).json({ error: { code: "INVALID_REFRESH_TOKEN", message: "Refresh token is invalid, expired, or already used." } });
      return;
    }
    res.json({ tokens });
  } catch (err) {
    req.log.error({ err }, "Token refresh failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Token refresh failed." } });
  }
});

export default router;
