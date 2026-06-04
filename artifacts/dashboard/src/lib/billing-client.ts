/**
 * billing-client.ts — Typed fetch wrapper for Phase 15 billing endpoints.
 */

import { apiFetch } from "./auth-client";

export interface BillingPlan {
  slug: string;
  name: string;
  description: string;
  priceMonthlyUsd: number;
  priceYearlyUsd: number;
  apiRequestsPerDay: number | null;
  backtestsPerMonth: number | null;
  aiTokensPerMonth: number;
  streamConnections: number;
  maxOrgMembers: number;
  features: Record<string, boolean>;
  sortOrder: number;
}

export interface BillingSubscription {
  id: string;
  organizationId: string;
  planSlug: string;
  status: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  trialEnd: string | null;
  createdAt: string;
}

export interface Invoice {
  id: string;
  stripeInvoiceId: string;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  status: string;
  description: string | null;
  invoicePdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  type: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
}

export interface UsageSummary {
  planSlug: string;
  periodStart: string;
  usage: Record<string, { used: number; limit: number | null; periodType: string | null }>;
}

export interface RevenueMetrics {
  mrrCents: number;
  arrCents: number;
  newMrrCents: number;
  churnMrrCents: number;
  expansionMrrCents: number;
  activeSubscriptions: number;
  trialSubscriptions: number;
  churnedCount: number;
  newCount: number;
  conversionRateBps: number;
}

// Plans
export async function apiListPlans(): Promise<{ plans: BillingPlan[] }> {
  return apiFetch("/billing/plans");
}

// Subscription
export async function apiGetSubscription(): Promise<{ subscription: BillingSubscription; plan: BillingPlan | undefined }> {
  return apiFetch("/billing/subscription");
}

export async function apiChangePlan(planSlug: string): Promise<{ subscription: BillingSubscription }> {
  return apiFetch("/billing/subscription", { method: "PATCH", body: JSON.stringify({ planSlug }) });
}

export async function apiCancelSubscription(immediately = false): Promise<{ subscription: BillingSubscription }> {
  return apiFetch(`/billing/subscription?immediately=${immediately}`, { method: "DELETE" });
}

// Customer
export async function apiGetCustomer(): Promise<{ customer: unknown; stripeConfigured: boolean }> {
  return apiFetch("/billing/customer");
}

export async function apiSyncCustomer(email?: string, name?: string): Promise<{ customer: unknown }> {
  return apiFetch("/billing/customer/sync", { method: "POST", body: JSON.stringify({ email, name }) });
}

// Payment methods
export async function apiListPaymentMethods(): Promise<{ paymentMethods: PaymentMethod[] }> {
  return apiFetch("/billing/payment-methods");
}

export async function apiDeletePaymentMethod(id: string): Promise<void> {
  return apiFetch(`/billing/payment-methods/${id}`, { method: "DELETE" });
}

export async function apiSetDefaultPaymentMethod(id: string): Promise<{ success: boolean }> {
  return apiFetch(`/billing/payment-methods/${id}/default`, { method: "PATCH" });
}

// Invoices
export async function apiListInvoices(limit = 20, offset = 0, sync = false): Promise<{ invoices: Invoice[] }> {
  return apiFetch(`/billing/invoices?limit=${limit}&offset=${offset}&sync=${sync}`);
}

// Usage
export async function apiGetUsage(): Promise<UsageSummary> {
  return apiFetch("/billing/usage");
}

// Portal
export async function apiCreatePortalSession(returnUrl?: string): Promise<{ url: string }> {
  return apiFetch("/billing/portal/session", { method: "POST", body: JSON.stringify({ returnUrl }) });
}

// Revenue (admin)
export async function apiGetRevenue(): Promise<{ metrics: RevenueMetrics }> {
  return apiFetch("/billing/revenue");
}

export async function apiGetRevenueHistory(limit = 30): Promise<{ history: unknown[] }> {
  return apiFetch(`/billing/revenue/history?limit=${limit}`);
}
