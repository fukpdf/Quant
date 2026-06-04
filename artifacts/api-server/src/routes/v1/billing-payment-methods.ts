import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import {
  listPaymentMethods, getPaymentMethod,
  insertPaymentMethod, deletePaymentMethod, setDefaultPaymentMethod,
} from "../../services/billing-db";
import { detachStripePaymentMethod, listStripePaymentMethods } from "../../services/stripe-client";
import { getBillingCustomer } from "../../services/billing-db";
import { isStripeConfigured } from "../../services/billing-types";

const router = Router();

// GET /billing/payment-methods
router.get("/billing/payment-methods", requireAuth, async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  // Optionally sync from Stripe
  const customer = await getBillingCustomer(orgId);
  if (customer?.stripeCustomerId && isStripeConfigured()) {
    const stripePms = await listStripePaymentMethods(customer.stripeCustomerId);
    for (const pm of stripePms) {
      const existing = (await listPaymentMethods(orgId)).find(m => m.stripePaymentMethodId === pm.id);
      if (!existing) {
        await insertPaymentMethod({
          organizationId:         orgId,
          stripePaymentMethodId:  pm.id,
          type:                   pm.type,
          brand:                  pm.card?.brand ?? null,
          last4:                  pm.card?.last4 ?? null,
          expMonth:               pm.card?.exp_month ?? null,
          expYear:                pm.card?.exp_year ?? null,
          isDefault:              false,
        });
      }
    }
  }

  const methods = await listPaymentMethods(orgId);
  res.json({ paymentMethods: methods });
});

// DELETE /billing/payment-methods/:id
router.delete("/billing/payment-methods/:id", requireAuth, requirePermission("users:write"), async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }
  const { id } = req.params as Record<string, string>;

  const pm = await getPaymentMethod(id);
  if (!pm || pm.organizationId !== orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment method not found" } });
    return;
  }

  if (isStripeConfigured()) {
    await detachStripePaymentMethod(pm.stripePaymentMethodId);
  }
  await deletePaymentMethod(id, orgId);
  res.status(204).end();
});

// PATCH /billing/payment-methods/:id/default
router.patch("/billing/payment-methods/:id/default", requireAuth, requirePermission("users:write"), async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }
  const { id } = req.params as Record<string, string>;

  const pm = await getPaymentMethod(id);
  if (!pm || pm.organizationId !== orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Payment method not found" } });
    return;
  }

  await setDefaultPaymentMethod(id, orgId);
  res.json({ success: true });
});

export default router;
