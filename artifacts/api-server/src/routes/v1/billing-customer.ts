import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { getBillingCustomer, upsertBillingCustomer } from "../../services/billing-db";
import { createStripeCustomer } from "../../services/stripe-client";
import { isStripeConfigured } from "../../services/billing-types";

const router = Router();

// GET /billing/customer
router.get("/billing/customer", requireAuth, async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }
  const customer = await getBillingCustomer(orgId);
  res.json({ customer: customer ?? null, stripeConfigured: isStripeConfigured() });
});

// POST /billing/customer/sync — create or sync Stripe customer for this org
router.post("/billing/customer/sync", requireAuth, requirePermission("users:write"), async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  let customer = await getBillingCustomer(orgId);
  if (!customer?.stripeCustomerId && isStripeConfigured()) {
    const { email, name } = req.body as { email?: string; name?: string };
    const stripeCustomer = await createStripeCustomer({
      email: email ?? req.auth!.email,
      name:  name,
      metadata: { organizationId: orgId },
    });

    customer = await upsertBillingCustomer({
      organizationId:   orgId,
      stripeCustomerId: stripeCustomer?.id ?? null,
    });
  } else if (!customer) {
    customer = await upsertBillingCustomer({ organizationId: orgId });
  }

  res.json({ customer });
});

export default router;
