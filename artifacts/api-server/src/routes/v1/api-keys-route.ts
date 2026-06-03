import { Router, type IRouter } from "express";
import { z } from "zod";
import { resolveAuth, requireAuth } from "../../middleware/auth-middleware";
import { createUserApiKey, getUserApiKeys, revokeUserApiKey } from "../../services/api-key-service";

const router: IRouter = Router();

const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()).min(1),
  organizationId: z.string().uuid().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

/**
 * GET /v1/auth/api-keys
 * List all API keys for the authenticated user.
 */
router.get("/auth/api-keys", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  try {
    const keys = await getUserApiKeys(auth.userId);
    res.json({ data: keys, total: keys.length });
  } catch (err) {
    req.log.error({ err }, "List API keys failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to list API keys." } });
  }
});

/**
 * POST /v1/auth/api-keys
 * Create a new API key. The raw key is returned ONLY in this response.
 */
router.post("/auth/api-keys", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const parse = CreateApiKeySchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  // Validate requested permissions are a subset of the user's permissions
  if (!auth.isSuperAdmin) {
    const invalid = parse.data.permissions.filter(p => !auth.permissions.includes(p));
    if (invalid.length > 0) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: `Cannot grant permissions you don't have: ${invalid.join(", ")}` } });
      return;
    }
  }

  try {
    const { apiKey, rawKey } = await createUserApiKey({
      userId: auth.userId,
      organizationId: parse.data.organizationId ?? null,
      name: parse.data.name,
      permissions: parse.data.permissions,
      expiresInDays: parse.data.expiresInDays,
      actorEmail: auth.email,
    });
    res.status(201).json({
      apiKey: { id: apiKey.id, name: apiKey.name, keyPrefix: apiKey.keyPrefix, permissions: apiKey.permissions, expiresAt: apiKey.expiresAt, createdAt: apiKey.createdAt },
      rawKey, // shown once only
      warning: "Store this key securely. It will not be shown again.",
    });
  } catch (err) {
    req.log.error({ err }, "Create API key failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create API key." } });
  }
});

/**
 * DELETE /v1/auth/api-keys/:keyId
 * Revoke an API key.
 */
router.delete("/auth/api-keys/:keyId", resolveAuth, requireAuth, async (req, res) => {
  const auth = req.auth!;
  const { keyId } = req.params as Record<string, string>;
  const reason = req.body?.reason as string | undefined;

  try {
    await revokeUserApiKey({ keyId, userId: auth.userId, actorEmail: auth.email, reason });
    res.json({ message: "API key revoked." });
  } catch (err) {
    req.log.error({ err }, "Revoke API key failed");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to revoke API key." } });
  }
});

export default router;
