/**
 * subscription-service.ts — Subscription lifecycle, plan seeding, and org plan resolution.
 * All imports at top (esbuild top-level import rule).
 */

import { logger } from "../lib/logger";
import {
  listBillingPlans, getBillingPlan, upsertBillingPlan,
  getSubscription, upsertSubscription, updateSubscription, listAllSubscriptions,
  getBillingCustomer, upsertBillingCustomer, getBillingCustomerByStripeId,
  upsertQuota, insertBillingEvent,
} from "./billing-db";
import {
  createStripeCustomer, createStripeSubscription, cancelStripeSubscription,
  updateStripeSubscription,
} from "./stripe-client";
import {
  PLAN_DEFINITIONS, QUOTA_DEFINITIONS, getBillingMode,
  type PlanSlug, type CreateSubscriptionInput, type ChangePlanInput,
} from "./billing-types";
import type { BillingSubscription } from "@workspace/db";

// ---------------------------------------------------------------------------
// Startup seeding
// ---------------------------------------------------------------------------

export async function seedBillingPlans(): Promise<void> {
  for (const plan of PLAN_DEFINITIONS) {
    await upsertBillingPlan({
      slug:               plan.slug,
      name:               plan.name,
      description:        plan.description,
      priceMonthlyUsd:    plan.priceMonthlyUsd,
      priceYearlyUsd:     plan.priceYearlyUsd,
      stripePriceMonthly: process.env[`STRIPE_PRICE_${plan.slug.toUpperCase()}_MONTHLY`] ?? null,
      stripePriceYearly:  process.env[`STRIPE_PRICE_${plan.slug.toUpperCase()}_YEARLY`] ?? null,
      apiRequestsPerDay:  plan.apiRequestsPerDay,
      backtestsPerMonth:  plan.backtestsPerMonth,
      aiTokensPerMonth:   plan.aiTokensPerMonth,
      streamConnections:  plan.streamConnections,
      maxOrgMembers:      plan.maxOrgMembers,
      maxApiKeys:         plan.maxApiKeys,
      features:           plan.features,
      sortOrder:          plan.sortOrder,
      isPublic:           true,
      isActive:           true,
    });
  }

  for (const quota of QUOTA_DEFINITIONS) {
    await upsertQuota({
      planSlug:      quota.planSlug,
      resourceType:  quota.resourceType,
      limitPerDay:   quota.limitPerDay,
      limitPerMonth: quota.limitPerMonth,
      isHardLimit:   quota.isHardLimit,
    });
  }

  logger.info("Billing: plans and quotas seeded");
}

// ---------------------------------------------------------------------------
// Plan resolution
// ---------------------------------------------------------------------------

export async function getOrgPlan(organizationId: string): Promise<PlanSlug> {
  const sub = await getSubscription(organizationId);
  if (!sub) return "free";
  if (sub.status === "active" || sub.status === "trialing") return sub.planSlug as PlanSlug;
  return "free";
}

export async function getOrgSubscription(organizationId: string): Promise<BillingSubscription | undefined> {
  return getSubscription(organizationId);
}

// ---------------------------------------------------------------------------
// Create / ensure free subscription on org creation
// ---------------------------------------------------------------------------

export async function ensureFreeSubscription(organizationId: string): Promise<BillingSubscription> {
  const existing = await getSubscription(organizationId);
  if (existing) return existing;

  return upsertSubscription({
    organizationId,
    planSlug: "free",
    status:   "active",
  });
}

// ---------------------------------------------------------------------------
// Change plan (local DB only — no Stripe call when offline)
// ---------------------------------------------------------------------------

export async function changePlan(input: ChangePlanInput): Promise<BillingSubscription> {
  const plan = await getBillingPlan(input.newPlanSlug);
  if (!plan) throw Object.assign(new Error(`Plan not found: ${input.newPlanSlug}`), { code: "PLAN_NOT_FOUND" });

  const existing = await getSubscription(input.organizationId);
  const mode = getBillingMode();

  // If Stripe subscription exists and we are in live mode, update it via Stripe
  if (mode === "live" && existing?.stripeSubscriptionId) {
    const stripePriceKey = `STRIPE_PRICE_${input.newPlanSlug.toUpperCase()}_MONTHLY`;
    const priceId = process.env[stripePriceKey];
    if (priceId && existing.stripeItemId) {
      await updateStripeSubscription(existing.stripeSubscriptionId, {
        items: [{ id: existing.stripeItemId, price: priceId }],
        proration_behavior: "create_prorations",
      });
    }
  }

  const sub = await upsertSubscription({
    organizationId:      input.organizationId,
    planSlug:            input.newPlanSlug,
    stripeSubscriptionId: existing?.stripeSubscriptionId ?? null,
    stripeItemId:        existing?.stripeItemId ?? null,
    status:              "active",
  });

  await insertBillingEvent({
    eventType:      "plan_changed",
    organizationId: input.organizationId,
    payload:        { previousPlan: existing?.planSlug ?? "none", newPlan: input.newPlanSlug },
    status:         "processed",
    processedAt:    new Date(),
  });

  logger.info({ organizationId: input.organizationId, planSlug: input.newPlanSlug }, "Billing: plan changed");
  return sub;
}

// ---------------------------------------------------------------------------
// Create Stripe-backed subscription
// ---------------------------------------------------------------------------

export async function createSubscription(input: CreateSubscriptionInput): Promise<BillingSubscription> {
  const mode = getBillingMode();

  let stripeSubId: string | undefined = input.stripeSubscriptionId;
  let stripeItemId: string | undefined = input.stripeItemId;

  if (mode === "live" && !stripeSubId) {
    let customer = await getBillingCustomer(input.organizationId);
    if (!customer?.stripeCustomerId) {
      throw Object.assign(
        new Error("Organization has no Stripe customer. Call POST /billing/customer first."),
        { code: "NO_STRIPE_CUSTOMER" },
      );
    }
    const priceKey = `STRIPE_PRICE_${input.planSlug.toUpperCase()}_MONTHLY`;
    const priceId  = process.env[priceKey];
    if (!priceId) throw Object.assign(new Error(`No Stripe price ID configured for plan: ${input.planSlug}`), { code: "NO_STRIPE_PRICE" });

    const stripeSub = await createStripeSubscription({
      customerId: customer.stripeCustomerId,
      priceId,
      trialDays:  input.trialDays,
    });
    stripeSubId  = stripeSub?.id;
    stripeItemId = stripeSub?.items.data[0]?.id;
  }

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return upsertSubscription({
    organizationId:       input.organizationId,
    planSlug:             input.planSlug,
    stripeSubscriptionId: stripeSubId ?? null,
    stripeItemId:         stripeItemId ?? null,
    status:               input.trialDays ? "trialing" : "active",
    currentPeriodStart:   now,
    currentPeriodEnd:     periodEnd,
    trialEnd:             input.trialDays ? new Date(now.getTime() + input.trialDays * 86400000) : null,
  });
}

// ---------------------------------------------------------------------------
// Cancel subscription
// ---------------------------------------------------------------------------

export async function cancelSubscription(organizationId: string, immediately = false): Promise<BillingSubscription> {
  const existing = await getSubscription(organizationId);
  if (!existing) throw Object.assign(new Error("No active subscription found"), { code: "NO_SUBSCRIPTION" });

  const mode = getBillingMode();
  if (mode === "live" && existing.stripeSubscriptionId) {
    await cancelStripeSubscription(existing.stripeSubscriptionId, immediately);
  }

  const sub = await updateSubscription(organizationId, {
    planSlug:           "free",
    status:             immediately ? "canceled" : "active",
    cancelAtPeriodEnd:  !immediately,
    canceledAt:         immediately ? new Date() : null,
  });

  await insertBillingEvent({
    eventType:      "subscription_canceled",
    organizationId,
    payload:        { immediately, previousPlan: existing.planSlug },
    status:         "processed",
    processedAt:    new Date(),
  });

  return sub;
}

// ---------------------------------------------------------------------------
// Handle Stripe webhook events
// ---------------------------------------------------------------------------

export async function handleStripeSubscriptionEvent(
  eventType: string,
  stripeSubscription: Record<string, unknown>,
): Promise<void> {
  const stripeSubId = stripeSubscription["id"] as string;
  const customerId  = stripeSubscription["customer"] as string;
  const status      = stripeSubscription["status"] as string;

  const customer = await getBillingCustomerByStripeId(customerId);
  if (!customer) {
    logger.warn({ stripeSubId, customerId }, "Billing: received Stripe subscription event for unknown customer");
    return;
  }

  const periodStart = stripeSubscription["current_period_start"];
  const periodEnd   = stripeSubscription["current_period_end"];
  const cancelAt    = stripeSubscription["cancel_at_period_end"] as boolean;
  const items       = stripeSubscription["items"] as { data: Array<{ id: string; price: { id: string } }> };
  const itemId      = items?.data?.[0]?.id;

  await updateSubscription(customer.organizationId, {
    stripeSubscriptionId: stripeSubId,
    stripeItemId:         itemId ?? null,
    status:               status as BillingSubscription["status"],
    cancelAtPeriodEnd:    cancelAt,
    currentPeriodStart:   periodStart ? new Date((periodStart as number) * 1000) : undefined,
    currentPeriodEnd:     periodEnd   ? new Date((periodEnd as number) * 1000)   : undefined,
  });

  logger.info({ organizationId: customer.organizationId, eventType, status }, "Billing: subscription updated from Stripe webhook");
}
