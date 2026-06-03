import argon2 from "argon2";

/**
 * password-service.ts — Argon2id password hashing and verification.
 *
 * Argon2id is the OWASP-recommended algorithm for password hashing.
 * Parameters follow OWASP guidelines:
 *   - memoryCost: 64 MB (65536 KiB)
 *   - timeCost: 3 iterations
 *   - parallelism: 4
 */

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,   // 64 MB
  timeCost: 3,
  parallelism: 4,
};

/**
 * Hash a plaintext password using Argon2id.
 * Returns the full encoded hash string (includes salt and params).
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2_OPTIONS);
}

/**
 * Verify a plaintext password against a stored Argon2id hash.
 * Returns true if the password matches, false otherwise.
 * Throws only on unexpected errors (not on mismatch).
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}

/**
 * Check if an existing hash needs to be re-hashed (e.g. parameters changed).
 * Call this after a successful verifyPassword — if true, re-hash and store.
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
