import { Router, type Request, type Response } from "express";
import { logger } from "../../lib/logger";
import { constructWebhookEvent } from "../../services/stripe-client";
import {
  getBillingCustomerByStripeId, insertBillingEvent,
  markBillingEventProcessed, getBillingEventByStripeId,
} from "../../services/billing-db";
import { handleStripeSubscriptionEvent } from "../../services/subscription-service";
import { handleStripeInvoiceEvent } from "../../services/invoice-service";

const router = Router();

// POST /billing/webhook — Stripe webhook endpoint (raw body required)
// Note: must use express.raw() — registered in app.ts before json() for this path
router.post(
  "/billing/webhook",
  async (req: Request, res: Response): Promise<void> => {
    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      res.status(400).json({ error: { code: "MISSING_SIGNATURE", message: "stripe-signature header required" } });
      return;
    }

    // constructWebhookEvent verifies signature and returns null on failure
    const event = constructWebhookEvent(req.body as Buffer, sig);
    if (!event) {
      res.status(400).json({ error: { code: "INVALID_SIGNATURE", message: "Webhook signature verification failed" } });
      return;
    }

    // Idempotency: skip already-processed events
    const existing = await getBillingEventByStripeId(event.id);
    if (existing?.status === "processed") {
      res.json({ received: true, skipped: true });
      return;
    }

    // Log the event immediately
    const record = await insertBillingEvent({
      stripeEventId: event.id,
      eventType:     event.type,
      payload:       event.data as unknown as Record<string, unknown>,
      status:        "pending",
    });

    try {
      const obj = event.data.object as unknown as Record<string, unknown>;
      const customerId = obj["customer"] as string | undefined;

      // Resolve org from Stripe customer
      let orgId: string | undefined;
      if (customerId) {
        const customer = await getBillingCustomerByStripeId(customerId);
        orgId = customer?.organizationId;
      }

      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
        case "customer.subscription.paused":
        case "customer.subscription.resumed":
          await handleStripeSubscriptionEvent(event.type, obj);
          break;

        case "invoice.paid":
        case "invoice.payment_failed":
        case "invoice.finalized":
          if (orgId) await handleStripeInvoiceEvent(orgId, obj);
          break;

        case "customer.created":
        case "customer.updated":
          // Handled by customer-service on demand
          break;

        default:
          logger.debug({ eventType: event.type }, "Billing: unhandled webhook event type (ignored)");
      }

      await markBillingEventProcessed(record.id);
      res.json({ received: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err, eventId: event.id }, "Billing: webhook processing failed");
      await markBillingEventProcessed(record.id, msg);
      // Return 200 to prevent Stripe from retrying non-transient errors
      res.json({ received: true, error: msg });
    }
  },
);

export default router;
