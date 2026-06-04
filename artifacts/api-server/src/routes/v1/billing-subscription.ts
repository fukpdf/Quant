import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import {
  getOrgSubscription, getOrgPlan, ensureFreeSubscription,
  changePlan, cancelSubscription,
} from "../../services/subscription-service";
import { listBillingPlans } from "../../services/billing-db";
import type { PlanSlug } from "../../services/billing-types";

const router = Router();

// GET /billing/subscription — current org subscription
router.get("/billing/subscription", requireAuth, async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const sub     = await getOrgSubscription(orgId) ?? await ensureFreeSubscription(orgId);
  const planSlug = await getOrgPlan(orgId);
  const plans   = await listBillingPlans(true);
  const plan    = plans.find(p => p.slug === planSlug);

  res.json({ subscription: sub, plan });
});

// POST /billing/subscription — create / upgrade subscription
router.post("/billing/subscription", requireAuth, requirePermission("users:write"), async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const { planSlug } = req.body as { planSlug?: PlanSlug };
  if (!planSlug) {
    res.status(400).json({ error: { code: "MISSING_PLAN", message: "planSlug is required" } });
    return;
  }

  const sub = await changePlan({ organizationId: orgId, newPlanSlug: planSlug });
  res.status(201).json({ subscription: sub });
});

// PATCH /billing/subscription — change plan
router.patch("/billing/subscription", requireAuth, requirePermission("users:write"), async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const { planSlug } = req.body as { planSlug?: PlanSlug };
  if (!planSlug) {
    res.status(400).json({ error: { code: "MISSING_PLAN", message: "planSlug is required" } });
    return;
  }

  const sub = await changePlan({ organizationId: orgId, newPlanSlug: planSlug });
  res.json({ subscription: sub });
});

// DELETE /billing/subscription — cancel subscription
router.delete("/billing/subscription", requireAuth, requirePermission("users:write"), async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const immediately = req.query["immediately"] === "true";
  const sub = await cancelSubscription(orgId, immediately);
  res.json({ subscription: sub });
});

export default router;
