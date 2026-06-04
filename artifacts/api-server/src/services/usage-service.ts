/**
 * usage-service.ts — Usage metering, quota enforcement, and period reset.
 * All imports at top (esbuild top-level import rule).
 */

import { logger } from "../lib/logger";
import { insertUsageRecord, getUsageSince, getUsageByResource, getQuota } from "./billing-db";
import { getOrgPlan } from "./subscription-service";
import type { RecordUsageInput, QuotaCheckResult, UsageResourceType } from "./billing-types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ---------------------------------------------------------------------------
// Record usage (fire-and-forget safe — never throws)
// ---------------------------------------------------------------------------

export async function recordUsage(input: RecordUsageInput): Promise<void> {
  try {
    await insertUsageRecord({
      organizationId: input.organizationId,
      userId:         input.userId ?? null,
      resourceType:   input.resourceType,
      quantity:       input.quantity ?? 1,
      metadata:       input.metadata ?? {},
    });
  } catch (err) {
    logger.warn({ err, input }, "Usage: failed to record usage (non-fatal)");
  }
}

// ---------------------------------------------------------------------------
// Check quota without recording usage
// ---------------------------------------------------------------------------

export async function checkQuota(
  organizationId: string,
  resourceType:   UsageResourceType,
): Promise<QuotaCheckResult> {
  const planSlug = await getOrgPlan(organizationId);
  const quota    = await getQuota(planSlug, resourceType);

  // No quota defined = unlimited
  if (!quota) {
    return {
      allowed:      true,
      resourceType,
      used:         0,
      limit:        null,
      periodType:   null,
      planSlug,
      isHardLimit:  false,
    };
  }

  // Check day limit first
  if (quota.limitPerDay !== null && quota.limitPerDay !== undefined) {
    const used = await getUsageSince(organizationId, resourceType, startOfToday());
    if (used >= quota.limitPerDay) {
      return {
        allowed:     !quota.isHardLimit,
        resourceType,
        used,
        limit:       quota.limitPerDay,
        periodType:  "day",
        planSlug,
        isHardLimit: quota.isHardLimit,
      };
    }
    return { allowed: true, resourceType, used, limit: quota.limitPerDay, periodType: "day", planSlug, isHardLimit: quota.isHardLimit };
  }

  // Then monthly limit
  if (quota.limitPerMonth !== null && quota.limitPerMonth !== undefined) {
    const used = await getUsageSince(organizationId, resourceType, startOfMonth());
    if (used >= quota.limitPerMonth) {
      return {
        allowed:     !quota.isHardLimit,
        resourceType,
        used,
        limit:       quota.limitPerMonth,
        periodType:  "month",
        planSlug,
        isHardLimit: quota.isHardLimit,
      };
    }
    return { allowed: true, resourceType, used, limit: quota.limitPerMonth, periodType: "month", planSlug, isHardLimit: quota.isHardLimit };
  }

  return { allowed: true, resourceType, used: 0, limit: null, periodType: null, planSlug, isHardLimit: false };
}

// ---------------------------------------------------------------------------
// Get full usage summary for an org (current month)
// ---------------------------------------------------------------------------

export async function getOrgUsageSummary(organizationId: string): Promise<{
  planSlug:   string;
  periodStart: string;
  usage:      Record<string, { used: number; limit: number | null; periodType: string | null }>;
}> {
  const planSlug = await getOrgPlan(organizationId);
  const since    = startOfMonth();
  const usage    = await getUsageByResource(organizationId, since);

  const resources: UsageResourceType[] = [
    "api_requests", "ai_tokens", "backtest_runs", "research_jobs", "stream_subscriptions",
  ];

  const result: Record<string, { used: number; limit: number | null; periodType: string | null }> = {};
  for (const rt of resources) {
    const quota = await getQuota(planSlug, rt);
    result[rt] = {
      used:       usage[rt] ?? 0,
      limit:      quota?.limitPerDay ?? quota?.limitPerMonth ?? null,
      periodType: quota?.limitPerDay ? "day" : quota?.limitPerMonth ? "month" : null,
    };
  }

  return {
    planSlug,
    periodStart: since.toISOString(),
    usage: result,
  };
}
