/**
 * invoice-service.ts — Invoice sync from Stripe and local invoice queries.
 * All imports at top (esbuild top-level import rule).
 */

import { logger } from "../lib/logger";
import { getBillingCustomer, listInvoices, getInvoice, upsertInvoice } from "./billing-db";
import { listStripeInvoices } from "./stripe-client";
import type { Invoice } from "@workspace/db";

// ---------------------------------------------------------------------------
// Sync invoices from Stripe into local DB
// ---------------------------------------------------------------------------

export async function syncInvoicesFromStripe(organizationId: string): Promise<Invoice[]> {
  const customer = await getBillingCustomer(organizationId);
  if (!customer?.stripeCustomerId) return [];

  const stripeInvoices = await listStripeInvoices(customer.stripeCustomerId, 50);
  const synced: Invoice[] = [];

  for (const inv of stripeInvoices) {
    try {
      const record = await upsertInvoice({
        organizationId,
        stripeInvoiceId:  inv.id,
        amountDueCents:   inv.amount_due,
        amountPaidCents:  inv.amount_paid,
        currency:         inv.currency,
        status:           inv.status ?? "draft",
        description:      inv.description ?? null,
        invoicePdfUrl:    inv.invoice_pdf ?? null,
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        periodStart:      inv.period_start ? new Date(inv.period_start * 1000) : null,
        periodEnd:        inv.period_end   ? new Date(inv.period_end * 1000)   : null,
        dueDate:          inv.due_date     ? new Date(inv.due_date * 1000)     : null,
        paidAt:           inv.status_transitions?.paid_at
                            ? new Date(inv.status_transitions.paid_at * 1000)
                            : null,
      });
      synced.push(record);
    } catch (err) {
      logger.warn({ err, invoiceId: inv.id }, "Invoice: failed to sync invoice");
    }
  }

  return synced;
}

// ---------------------------------------------------------------------------
// List invoices for an org (from local DB, optionally syncing first)
// ---------------------------------------------------------------------------

export async function getOrgInvoices(
  organizationId: string,
  opts?: { limit?: number; offset?: number; sync?: boolean },
): Promise<Invoice[]> {
  if (opts?.sync) await syncInvoicesFromStripe(organizationId);
  return listInvoices(organizationId, opts?.limit ?? 20, opts?.offset ?? 0);
}

export async function getOrgInvoice(organizationId: string, invoiceId: string): Promise<Invoice | undefined> {
  return getInvoice(invoiceId, organizationId);
}

// ---------------------------------------------------------------------------
// Handle Stripe invoice.paid webhook event
// ---------------------------------------------------------------------------

export async function handleStripeInvoiceEvent(
  organizationId: string,
  stripeInvoice: Record<string, unknown>,
): Promise<void> {
  const status       = stripeInvoice["status"] as string;
  const paidAt       = stripeInvoice["status_transitions"]
    ? ((stripeInvoice["status_transitions"] as Record<string, unknown>)["paid_at"] as number | null)
    : null;

  await upsertInvoice({
    organizationId,
    stripeInvoiceId:  stripeInvoice["id"] as string,
    amountDueCents:   (stripeInvoice["amount_due"] as number) ?? 0,
    amountPaidCents:  (stripeInvoice["amount_paid"] as number) ?? 0,
    currency:         (stripeInvoice["currency"] as string) ?? "usd",
    status,
    description:      (stripeInvoice["description"] as string) ?? null,
    invoicePdfUrl:    (stripeInvoice["invoice_pdf"] as string) ?? null,
    hostedInvoiceUrl: (stripeInvoice["hosted_invoice_url"] as string) ?? null,
    periodStart:      stripeInvoice["period_start"] ? new Date((stripeInvoice["period_start"] as number) * 1000) : null,
    periodEnd:        stripeInvoice["period_end"]   ? new Date((stripeInvoice["period_end"] as number) * 1000)   : null,
    paidAt:           paidAt ? new Date(paidAt * 1000) : null,
  });
}
