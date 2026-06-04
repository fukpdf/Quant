/**
 * billing-types.ts — Shared TypeScript types for the Phase 15 billing subsystem.
 * All imports at top (esbuild top-level import rule).
 */

// ---------------------------------------------------------------------------
// Plan tier
// ---------------------------------------------------------------------------

export type PlanSlug = "free" | "pro" | "team" | "enterprise";

export const PLAN_ORDER: PlanSlug[] = ["free", "pro", "team", "enterprise"];

export function planRank(slug: PlanSlug): number {
  return PLAN_ORDER.indexOf(slug);
}

export function planMeetsMinimum(actual: PlanSlug, minimum: PlanSlug): boolean {
  return planRank(actual) >= planRank(minimum);
}

// ---------------------------------------------------------------------------
// Resource types
// ---------------------------------------------------------------------------

export type UsageResourceType =
  | "api_requests"
  | "ai_tokens"
  | "backtest_runs"
  | "research_jobs"
  | "stream_subscriptions";

// ---------------------------------------------------------------------------
// Subscription status
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

// ---------------------------------------------------------------------------
// Billing mode
// ---------------------------------------------------------------------------

export type BillingMode = "offline" | "live";

export function getBillingMode(): BillingMode {
  const mode = process.env["BILLING_MODE"] ?? "offline";
  return mode === "live" ? "live" : "offline";
}

export function isStripeConfigured(): boolean {
  return !!process.env["STRIPE_SECRET_KEY"];
}

// ---------------------------------------------------------------------------
// Plan definitions (seeded on startup)
// ---------------------------------------------------------------------------

export interface PlanDefinition {
  slug:                PlanSlug;
  name:                string;
  description:         string;
  priceMonthlyUsd:     number;
  priceYearlyUsd:      number;
  apiRequestsPerDay:   number | null;
  backtestsPerMonth:   number | null;
  aiTokensPerMonth:    number;
  streamConnections:   number;
  maxOrgMembers:       number;
  maxApiKeys:          number;
  features:            Record<string, boolean>;
  sortOrder:           number;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    slug: "free",
    name: "Free",
    description: "Get started with basic market data and backtesting",
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    apiRequestsPerDay: 100,
    backtestsPerMonth: 5,
    aiTokensPerMonth: 0,
    streamConnections: 0,
    maxOrgMembers: 1,
    maxApiKeys: 1,
    features: {
      candles: true,
      markets: true,
      backtesting: true,
      paperTrading: false,
      riskEngine: false,
      aiResearch: false,
      streaming: false,
      portfolioAnalytics: false,
      intelligence: false,
    },
    sortOrder: 0,
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Full platform access for individual quant traders",
    priceMonthlyUsd: 2900,
    priceYearlyUsd: 29000,
    apiRequestsPerDay: 10000,
    backtestsPerMonth: 100,
    aiTokensPerMonth: 50000,
    streamConnections: 5,
    maxOrgMembers: 3,
    maxApiKeys: 5,
    features: {
      candles: true,
      markets: true,
      backtesting: true,
      paperTrading: true,
      riskEngine: true,
      aiResearch: true,
      streaming: true,
      portfolioAnalytics: true,
      intelligence: false,
    },
    sortOrder: 1,
  },
  {
    slug: "team",
    name: "Team",
    description: "Collaborative quant research for small trading teams",
    priceMonthlyUsd: 9900,
    priceYearlyUsd: 99000,
    apiRequestsPerDay: 100000,
    backtestsPerMonth: null,
    aiTokensPerMonth: 500000,
    streamConnections: 20,
    maxOrgMembers: 25,
    maxApiKeys: 20,
    features: {
      candles: true,
      markets: true,
      backtesting: true,
      paperTrading: true,
      riskEngine: true,
      aiResearch: true,
      streaming: true,
      portfolioAnalytics: true,
      intelligence: true,
    },
    sortOrder: 2,
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    description: "Unlimited access with dedicated support and custom integrations",
    priceMonthlyUsd: 0,
    priceYearlyUsd: 0,
    apiRequestsPerDay: null,
    backtestsPerMonth: null,
    aiTokensPerMonth: 0,
    streamConnections: 100,
    maxOrgMembers: 0,
    maxApiKeys: 100,
    features: {
      candles: true,
      markets: true,
      backtesting: true,
      paperTrading: true,
      riskEngine: true,
      aiResearch: true,
      streaming: true,
      portfolioAnalytics: true,
      intelligence: true,
    },
    sortOrder: 3,
  },
];

// ---------------------------------------------------------------------------
// Quota definitions (seeded on startup)
// ---------------------------------------------------------------------------

export interface QuotaDefinition {
  planSlug:      PlanSlug;
  resourceType:  UsageResourceType;
  limitPerDay:   number | null;
  limitPerMonth: number | null;
  isHardLimit:   boolean;
}

export const QUOTA_DEFINITIONS: QuotaDefinition[] = [
  // Free
  { planSlug: "free", resourceType: "api_requests",       limitPerDay: 100,   limitPerMonth: null,  isHardLimit: true  },
  { planSlug: "free", resourceType: "backtest_runs",       limitPerDay: null,  limitPerMonth: 5,     isHardLimit: true  },
  { planSlug: "free", resourceType: "ai_tokens",           limitPerDay: 0,     limitPerMonth: 0,     isHardLimit: true  },
  { planSlug: "free", resourceType: "stream_subscriptions",limitPerDay: 0,     limitPerMonth: 0,     isHardLimit: true  },
  // Pro
  { planSlug: "pro",  resourceType: "api_requests",        limitPerDay: 10000, limitPerMonth: null,  isHardLimit: true  },
  { planSlug: "pro",  resourceType: "backtest_runs",        limitPerDay: null,  limitPerMonth: 100,   isHardLimit: false },
  { planSlug: "pro",  resourceType: "ai_tokens",            limitPerDay: null,  limitPerMonth: 50000, isHardLimit: false },
  { planSlug: "pro",  resourceType: "stream_subscriptions", limitPerDay: null,  limitPerMonth: null,  isHardLimit: false },
  // Team
  { planSlug: "team", resourceType: "api_requests",         limitPerDay: 100000,limitPerMonth: null,  isHardLimit: false },
  { planSlug: "team", resourceType: "ai_tokens",             limitPerDay: null,  limitPerMonth: 500000,isHardLimit: false },
  // Enterprise — no quotas (unlimited)
];

// ---------------------------------------------------------------------------
// Service I/O types
// ---------------------------------------------------------------------------

export interface CreateSubscriptionInput {
  organizationId:        string;
  planSlug:              PlanSlug;
  stripeSubscriptionId?: string;
  stripeItemId?:         string;
  trialDays?:            number;
}

export interface ChangePlanInput {
  organizationId: string;
  newPlanSlug:    PlanSlug;
}

export interface RecordUsageInput {
  organizationId: string;
  userId?:        string;
  resourceType:   UsageResourceType;
  quantity?:      number;
  metadata?:      Record<string, unknown>;
}

export interface QuotaCheckResult {
  allowed:       boolean;
  resourceType:  UsageResourceType;
  used:          number;
  limit:         number | null;
  periodType:    "day" | "month" | null;
  planSlug:      PlanSlug;
  isHardLimit:   boolean;
}

export interface RevenueMetrics {
  mrrCents:              number;
  arrCents:              number;
  newMrrCents:           number;
  churnMrrCents:         number;
  expansionMrrCents:     number;
  activeSubscriptions:   number;
  trialSubscriptions:    number;
  churnedCount:          number;
  newCount:              number;
  conversionRateBps:     number;
}

// ---------------------------------------------------------------------------
// Billing context (attached to req by plan-middleware)
// ---------------------------------------------------------------------------

export interface BillingContext {
  organizationId:  string;
  planSlug:        PlanSlug;
  subscriptionStatus: SubscriptionStatus | "none";
}
