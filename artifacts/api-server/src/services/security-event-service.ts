import { insertSecurityEvent, countRecentFailedLogins, lockUserAccount, updateUser } from "./auth-db";
import { logger } from "../lib/logger";
import type { SecurityEventInput } from "./auth-types";

/**
 * security-event-service.ts — Security event tracking and brute-force protection.
 *
 * Brute-force protection rules:
 *   - After 5 failed logins in 15 minutes: lock account for 15 minutes
 *   - After 10 failed logins in 15 minutes: lock account for 1 hour
 *   - After 20 failed logins in 15 minutes: lock account for 24 hours
 */

const BRUTE_FORCE_WINDOW_MINUTES = 15;
const LOCK_THRESHOLDS = [
  { failures: 5, lockMinutes: 15 },
  { failures: 10, lockMinutes: 60 },
  { failures: 20, lockMinutes: 1440 },
];

/**
 * Record a security event to the security_events table.
 */
export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await insertSecurityEvent({
      userId: input.userId ?? null,
      eventType: input.eventType,
      severity: input.severity ?? "info",
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
      details: input.details ?? null,
      organizationId: input.organizationId ?? null,
    });
  } catch (err) {
    logger.error({ err, input }, "Failed to record security event");
  }
}

/**
 * Check brute-force threshold and apply account lockout if exceeded.
 * Call this after every failed login attempt.
 */
export async function checkAndApplyBruteForceProtection(
  userId: string,
  email: string,
): Promise<{ locked: boolean; lockUntil: Date | null }> {
  const failureCount = await countRecentFailedLogins(email, BRUTE_FORCE_WINDOW_MINUTES);

  for (const { failures, lockMinutes } of [...LOCK_THRESHOLDS].reverse()) {
    if (failureCount >= failures) {
      const lockUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
      await lockUserAccount(userId, lockUntil);

      await recordSecurityEvent({
        userId,
        eventType: "account_locked",
        severity: "critical",
        details: { failureCount, lockUntil: lockUntil.toISOString(), windowMinutes: BRUTE_FORCE_WINDOW_MINUTES },
      });

      logger.warn({ userId, email, failureCount, lockMinutes }, "Account locked due to brute-force detection");
      return { locked: true, lockUntil };
    }
  }

  return { locked: false, lockUntil: null };
}

/**
 * Check if an account is currently locked.
 * Returns the lockUntil date if locked, null if not locked.
 */
export function isAccountLocked(lockedUntil: Date | null | undefined): Date | null {
  if (!lockedUntil) return null;
  const now = new Date();
  return lockedUntil > now ? lockedUntil : null;
}
