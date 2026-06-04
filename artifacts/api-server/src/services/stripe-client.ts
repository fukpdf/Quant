/**
 * stripe-client.ts — Stripe SDK wrapper with graceful offline mode.
 * When STRIPE_SECRET_KEY is not set, all methods return null/throw with a
 * clear message — the rest of the billing stack degrades gracefully.
 *
 * All imports at top (esbuild top-level import rule).
 */

import Stripe from "stripe";
import { logger } from "../lib/logger";

// ---------------------------------------------------------------------------
// Lazy singleton — only initialised when STRIPE_SECRET_KEY is present
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

export function getStripeClient(): Stripe | null {
  if (_stripe) return _stripe;
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) return null;
  _stripe = new Stripe(key, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });
  return _stripe;
}

export function requireStripeClient(): Stripe {
  const client = getStripeClient();
  if (!client) {
    throw Object.assign(
      new Error("Stripe is not configured. Set STRIPE_SECRET_KEY to enable billing features."),
      { code: "STRIPE_NOT_CONFIGURED" },
    );
  }
  return client;
}

// ---------------------------------------------------------------------------
// Webhook signature verification
// ---------------------------------------------------------------------------

export function constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event | null {
  const stripe = getStripeClient();
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!stripe || !secret) return null;
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    logger.warn({ err }, "Stripe webhook signature verification failed");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Customer operations
// ---------------------------------------------------------------------------

export async function createStripeCustomer(params: {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Customer | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  return stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: params.metadata ?? {},
  });
}

export async function getStripeCustomer(customerId: string): Promise<Stripe.Customer | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  return customer as Stripe.Customer;
}

export async function updateStripeCustomer(customerId: string, params: Stripe.CustomerUpdateParams): Promise<Stripe.Customer | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  return stripe.customers.update(customerId, params);
}

// ---------------------------------------------------------------------------
// Subscription operations
// ---------------------------------------------------------------------------

export async function createStripeSubscription(params: {
  customerId: string;
  priceId:    string;
  trialDays?: number;
  metadata?:  Record<string, string>;
}): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  return stripe.subscriptions.create({
    customer:       params.customerId,
    items:          [{ price: params.priceId }],
    trial_period_days: params.trialDays,
    metadata:       params.metadata ?? {},
    expand:         ["latest_invoice.payment_intent"],
  });
}

export async function updateStripeSubscription(
  subscriptionId: string,
  params: Stripe.SubscriptionUpdateParams,
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  return stripe.subscriptions.update(subscriptionId, params);
}

export async function cancelStripeSubscription(subscriptionId: string, immediately = false): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }
  return stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

// ---------------------------------------------------------------------------
// Payment method operations
// ---------------------------------------------------------------------------

export async function listStripePaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
  const stripe = getStripeClient();
  if (!stripe) return [];
  const list = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
  return list.data;
}

export async function detachStripePaymentMethod(paymentMethodId: string): Promise<void> {
  const stripe = getStripeClient();
  if (!stripe) return;
  await stripe.paymentMethods.detach(paymentMethodId);
}

// ---------------------------------------------------------------------------
// Invoice operations
// ---------------------------------------------------------------------------

export async function listStripeInvoices(customerId: string, limit = 20): Promise<Stripe.Invoice[]> {
  const stripe = getStripeClient();
  if (!stripe) return [];
  const list = await stripe.invoices.list({ customer: customerId, limit });
  return list.data;
}

// ---------------------------------------------------------------------------
// Customer portal session
// ---------------------------------------------------------------------------

export async function createCustomerPortalSession(params: {
  customerId:  string;
  returnUrl:   string;
}): Promise<Stripe.BillingPortal.Session | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;
  return stripe.billingPortal.sessions.create({
    customer:   params.customerId,
    return_url: params.returnUrl,
  });
}
