import {
  createApiKey, findApiKeyByHash, listApiKeysByUser, revokeApiKey, updateApiKeyLastUsed,
} from "./auth-db";
import { generateApiKey, hashApiKey } from "./token-service";
import { auditLog } from "./auth-audit-service";
import { recordSecurityEvent } from "./security-event-service";
import type { ApiKey } from "@workspace/db";

/**
 * api-key-service.ts — API key lifecycle management.
 *
 * Raw keys are returned only once on creation; thereafter only the hash is stored.
 * Key format: qf_<64 hex chars>
 */

export async function createUserApiKey(opts: {
  userId: string;
  organizationId: string | null;
  name: string;
  permissions: string[];
  expiresInDays?: number;
  actorEmail: string;
}): Promise<{ apiKey: ApiKey; rawKey: string }> {
  const { raw, hash, prefix } = generateApiKey();
  const expiresAt = opts.expiresInDays
    ? new Date(Date.now() + opts.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const apiKey = await createApiKey({
    userId: opts.userId,
    organizationId: opts.organizationId,
    name: opts.name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions: opts.permissions,
    isRevoked: false,
    expiresAt,
  });

  await recordSecurityEvent({ userId: opts.userId, eventType: "api_key_created", severity: "info", organizationId: opts.organizationId, details: { keyId: apiKey.id, name: opts.name } });
  await auditLog({ actorId: opts.userId, actorEmail: opts.actorEmail, action: "api_key.create", resource: "api_key", resourceId: apiKey.id, organizationId: opts.organizationId, afterState: { name: opts.name, prefix } });

  return { apiKey, rawKey: raw };
}

export async function validateApiKey(rawKey: string): Promise<ApiKey | null> {
  const hash = hashApiKey(rawKey);
  const key = await findApiKeyByHash(hash);
  if (!key) return null;
  if (key.isRevoked) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;
  await updateApiKeyLastUsed(key.id);
  return key;
}

export async function getUserApiKeys(userId: string): Promise<Omit<ApiKey, "keyHash">[]> {
  const keys = await listApiKeysByUser(userId);
  return keys.map(({ keyHash: _kh, ...rest }) => rest);
}

export async function revokeUserApiKey(opts: {
  keyId: string;
  userId: string;
  actorEmail: string;
  reason?: string;
}): Promise<void> {
  await revokeApiKey(opts.keyId, opts.reason);
  await recordSecurityEvent({ userId: opts.userId, eventType: "api_key_revoked", severity: "info", details: { keyId: opts.keyId } });
  await auditLog({ actorId: opts.userId, actorEmail: opts.actorEmail, action: "api_key.revoke", resource: "api_key", resourceId: opts.keyId, metadata: { reason: opts.reason } });
}
