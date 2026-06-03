import rateLimit from "express-rate-limit";

/**
 * rate-limit-middleware.ts — Express-rate-limit v8 configurations.
 *
 * Three tiers:
 *   - general:   200 req / 15 min  (all API routes)
 *   - auth:       20 req / 15 min  (login, register, password reset)
 *   - strict:      5 req / 15 min  (password reset by email, sensitive ops)
 *
 * No custom keyGenerator — the built-in default handles both IPv4 and IPv6
 * correctly. express-rate-limit v8 raises ERR_ERL_KEY_GEN_IPV6 when a custom
 * keyGenerator reads req.ip without the ipKeyGenerator helper, so we rely on
 * the default instead.
 */

const windowMs = 15 * 60 * 1000; // 15 minutes

export const generalRateLimit = rateLimit({
  windowMs,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests — please try again later." } },
  skip: () => process.env["NODE_ENV"] === "test",
});

export const authRateLimit = rateLimit({
  windowMs,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many authentication attempts — please wait 15 minutes." } },
  skip: () => process.env["NODE_ENV"] === "test",
});

export const strictRateLimit = rateLimit({
  windowMs,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests for this sensitive endpoint — please wait 15 minutes." } },
  skip: () => process.env["NODE_ENV"] === "test",
});
