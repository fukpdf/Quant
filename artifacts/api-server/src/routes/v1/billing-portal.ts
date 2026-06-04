import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { getBillingCustomer } from "../../services/billing-db";
import { createCustomerPortalSession } from "../../services/stripe-client";
import { isStripeConfigured } from "../../services/billing-types";

const router = Router();

// POST /billing/portal/session — create a Stripe customer portal session
router.post("/billing/portal/session", requireAuth, requirePermission("users:write"), async (req, res) => {
  if (!isStripeConfigured()) {
    res.status(503).json({
      error: {
        code:    "STRIPE_NOT_CONFIGURED",
        message: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable the billing portal.",
      },
    });
    return;
  }

  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const customer = await getBillingCustomer(orgId);
  if (!customer?.stripeCustomerId) {
    res.status(400).json({
      error: {
        code:    "NO_STRIPE_CUSTOMER",
        message: "No Stripe customer found. Call POST /billing/customer/sync first.",
      },
    });
    return;
  }

  const returnUrl = (req.body as { returnUrl?: string }).returnUrl
    ?? `${process.env["CORS_ORIGIN"] ?? "http://localhost:5000"}/billing`;

  const session = await createCustomerPortalSession({
    customerId: customer.stripeCustomerId,
    returnUrl,
  });

  if (!session) {
    res.status(500).json({ error: { code: "PORTAL_FAILED", message: "Failed to create customer portal session" } });
    return;
  }

  res.json({ url: session.url });
});

export default router;
