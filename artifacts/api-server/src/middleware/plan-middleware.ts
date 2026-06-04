/**
 * plan-middleware.ts — Plan-aware middleware for feature gating and quota enforcement.
 *
 * requirePlan(minPlan)    — Rejects the request with 402 if org is below the minimum plan.
 * enforceQuota(resource)  — Rejects with 429 if the org has exceeded its quota (hard limits only).
 * trackUsage(resource)    — Records usage after the request completes (non-blocking, never throws).
 *
 * All imports at top (esbuild top-level import rule).
 */

import { type Request, type Response, type NextFunction } from "express";
import { logger } from "../lib/logger";
import { getOrgPlan } from "../services/subscription-service";
import { checkQuota, recordUsage } from "../services/usage-service";
import { planMeetsMinimum, type PlanSlug, type UsageResourceType } from "../services/billing-types";

// ---------------------------------------------------------------------------
// requirePlan — block request if org is below minimum plan
// ---------------------------------------------------------------------------

export function requirePlan(minPlan: PlanSlug) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.auth?.organizationId ?? req.tenant?.organizationId;
    if (!orgId) {
      res.status(402).json({ error: { code: "NO_ORG", message: "An organization context is required. Set the X-Organization-Id header." } });
      return;
    }

    try {
      const planSlug = await getOrgPlan(orgId);
      if (!planMeetsMinimum(planSlug, minPlan)) {
        res.status(402).json({
          error: {
            code:       "PLAN_REQUIRED",
            message:    `This feature requires the ${minPlan} plan or higher. Current plan: ${planSlug}.`,
            currentPlan: planSlug,
            requiredPlan: minPlan,
          },
        });
        return;
      }
    } catch (err) {
      logger.warn({ err }, "plan-middleware: failed to resolve plan (allowing request)");
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// enforceQuota — block request if hard quota is exceeded
// ---------------------------------------------------------------------------

export function enforceQuota(resource: UsageResourceType, quantity = 1) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const orgId = req.auth?.organizationId ?? req.tenant?.organizationId;
    if (!orgId) { next(); return; }

    try {
      const result = await checkQuota(orgId, resource);
      // Only block on hard limits
      if (!result.allowed && result.isHardLimit) {
        res.status(429).json({
          error: {
            code:        "QUOTA_EXCEEDED",
            message:     `You have exceeded your ${result.periodType ?? "period"} quota for ${resource}. Used: ${result.used}, Limit: ${result.limit}. Upgrade your plan to continue.`,
            resource,
            used:        result.used,
            limit:       result.limit,
            periodType:  result.periodType,
            planSlug:    result.planSlug,
          },
        });
        return;
      }
    } catch (err) {
      logger.warn({ err, resource }, "plan-middleware: failed to check quota (allowing request)");
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// trackUsage — fire-and-forget usage recording after request succeeds
// ---------------------------------------------------------------------------

export function trackUsage(resource: UsageResourceType, quantity = 1) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const orgId  = req.auth?.organizationId ?? req.tenant?.organizationId;
    const userId = req.auth?.userId;

    res.on("finish", () => {
      if (res.statusCode < 400 && orgId) {
        recordUsage({ organizationId: orgId, userId, resourceType: resource, quantity }).catch((err) => {
          logger.warn({ err, resource }, "trackUsage: failed to record usage (non-fatal)");
        });
      }
    });

    next();
  };
}
