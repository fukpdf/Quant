/**
 * revenue-analytics-service.ts — MRR, ARR, churn, and conversion analytics.
 * Computed from DB subscription data; never makes live Stripe API calls.
 * All imports at top (esbuild top-level import rule).
 */

import { listAllSubscriptions, listBillingPlans, upsertRevenueSnapshot, listRevenueSnapshots, getLatestRevenueSnapshot } from "./billing-db";
import { logger } from "../lib/logger";
import type { RevenueSnapshot } from "@workspace/db";
import type { RevenueMetrics } from "./billing-types";

// ---------------------------------------------------------------------------
// Compute current MRR from active subscriptions
// ---------------------------------------------------------------------------

export async function computeRevenueMetrics(): Promise<RevenueMetrics> {
  const plans = await listBillingPlans(false);
  const planPriceMap = new Map<string, number>();
  for (const p of plans) planPriceMap.set(p.slug, p.priceMonthlyUsd);

  const allSubs = await listAllSubscriptions();

  let mrrCents           = 0;
  let activeSubscriptions = 0;
  let trialSubscriptions  = 0;

  for (const sub of allSubs) {
    const price = planPriceMap.get(sub.planSlug) ?? 0;
    if (sub.status === "active" && sub.planSlug !== "free") {
      mrrCents += price;
      activeSubscriptions++;
    } else if (sub.status === "trialing") {
      trialSubscriptions++;
    }
  }

  const arrCents = mrrCents * 12;

  // Delta metrics from yesterday's snapshot
  const yesterday = await getLatestRevenueSnapshot();
  const prevMrr   = yesterday?.mrrCents ?? 0;
  const newMrrCents      = mrrCents > prevMrr ? mrrCents - prevMrr : 0;
  const churnMrrCents    = mrrCents < prevMrr ? prevMrr - mrrCents : 0;
  const expansionMrrCents = 0; // Future: track plan upgrades

  // Conversion rate: trialing → active (bps = basis points, 100 = 1%)
  const totalTrial       = trialSubscriptions + activeSubscriptions;
  const conversionRateBps = totalTrial > 0 ? Math.round((activeSubscriptions / totalTrial) * 10000) : 0;

  return {
    mrrCents,
    arrCents,
    newMrrCents,
    churnMrrCents,
    expansionMrrCents,
    activeSubscriptions,
    trialSubscriptions,
    churnedCount: 0,
    newCount:     0,
    conversionRateBps,
  };
}

// ---------------------------------------------------------------------------
// Snapshot today's metrics
// ---------------------------------------------------------------------------

export async function snapshotRevenueMetrics(): Promise<RevenueSnapshot> {
  const metrics = await computeRevenueMetrics();
  const today   = new Date().toISOString().split("T")[0]!;

  const snapshot = await upsertRevenueSnapshot({
    snapshotDate:        today,
    mrrCents:            metrics.mrrCents,
    arrCents:            metrics.arrCents,
    newMrrCents:         metrics.newMrrCents,
    churnMrrCents:       metrics.churnMrrCents,
    expansionMrrCents:   metrics.expansionMrrCents,
    activeSubscriptions: metrics.activeSubscriptions,
    trialSubscriptions:  metrics.trialSubscriptions,
    churnedCount:        metrics.churnedCount,
    newCount:            metrics.newCount,
    conversionRate:      metrics.conversionRateBps,
  });

  logger.info({ mrrCents: metrics.mrrCents, activeSubscriptions: metrics.activeSubscriptions }, "Billing: revenue snapshot saved");
  return snapshot;
}

// ---------------------------------------------------------------------------
// Get revenue history
// ---------------------------------------------------------------------------

export async function getRevenueHistory(limit = 30): Promise<RevenueSnapshot[]> {
  return listRevenueSnapshots(limit);
}

export async function getLatestRevenue(): Promise<RevenueMetrics> {
  return computeRevenueMetrics();
}
