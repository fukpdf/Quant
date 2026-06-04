/**
 * billing-db.ts — Raw DB access for all Phase 15 billing tables.
 * All imports at top (esbuild top-level import rule).
 */

import { eq, and, gte, lt, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  billingPlansTable,
  billingCustomersTable,
  billingSubscriptionsTable,
  paymentMethodsTable,
  invoicesTable,
  usageRecordsTable,
  usageQuotasTable,
  billingEventsTable,
  revenueSnapshotsTable,
} from "@workspace/db";
import type {
  BillingPlan, InsertBillingPlan,
  BillingCustomer, InsertBillingCustomer,
  BillingSubscription, InsertBillingSubscription,
  PaymentMethod, InsertPaymentMethod,
  Invoice, InsertInvoice,
  UsageRecord, InsertUsageRecord,
  UsageQuota, InsertUsageQuota,
  BillingEvent, InsertBillingEvent,
  RevenueSnapshot, InsertRevenueSnapshot,
} from "@workspace/db";
import type { PlanSlug, UsageResourceType } from "./billing-types";

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

export async function listBillingPlans(publicOnly = true): Promise<BillingPlan[]> {
  const conditions = [eq(billingPlansTable.isActive, true)];
  if (publicOnly) conditions.push(eq(billingPlansTable.isPublic, true));
  return db.select().from(billingPlansTable).where(and(...conditions)).orderBy(billingPlansTable.sortOrder);
}

export async function getBillingPlan(slug: string): Promise<BillingPlan | undefined> {
  const [row] = await db.select().from(billingPlansTable).where(eq(billingPlansTable.slug, slug));
  return row;
}

export async function upsertBillingPlan(data: InsertBillingPlan): Promise<BillingPlan> {
  const [row] = await db.insert(billingPlansTable).values(data)
    .onConflictDoUpdate({ target: billingPlansTable.slug, set: { ...data, updatedAt: new Date() } })
    .returning();
  return row!;
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function getBillingCustomer(orgId: string): Promise<BillingCustomer | undefined> {
  const [row] = await db.select().from(billingCustomersTable)
    .where(eq(billingCustomersTable.organizationId, orgId));
  return row;
}

export async function getBillingCustomerByStripeId(stripeCustomerId: string): Promise<BillingCustomer | undefined> {
  const [row] = await db.select().from(billingCustomersTable)
    .where(eq(billingCustomersTable.stripeCustomerId, stripeCustomerId));
  return row;
}

export async function upsertBillingCustomer(data: InsertBillingCustomer): Promise<BillingCustomer> {
  const [row] = await db.insert(billingCustomersTable).values(data)
    .onConflictDoUpdate({ target: billingCustomersTable.organizationId, set: { ...data, updatedAt: new Date() } })
    .returning();
  return row!;
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

export async function getSubscription(orgId: string): Promise<BillingSubscription | undefined> {
  const [row] = await db.select().from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.organizationId, orgId));
  return row;
}

export async function getSubscriptionByStripeId(stripeSubId: string): Promise<BillingSubscription | undefined> {
  const [row] = await db.select().from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.stripeSubscriptionId, stripeSubId));
  return row;
}

export async function upsertSubscription(data: InsertBillingSubscription): Promise<BillingSubscription> {
  const [row] = await db.insert(billingSubscriptionsTable).values(data)
    .onConflictDoUpdate({ target: billingSubscriptionsTable.organizationId, set: { ...data, updatedAt: new Date() } })
    .returning();
  return row!;
}

export async function updateSubscription(orgId: string, data: Partial<InsertBillingSubscription>): Promise<BillingSubscription> {
  const [row] = await db.update(billingSubscriptionsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(billingSubscriptionsTable.organizationId, orgId))
    .returning();
  return row!;
}

export async function listAllSubscriptions(statuses?: string[]): Promise<BillingSubscription[]> {
  if (statuses && statuses.length > 0) {
    return db.select().from(billingSubscriptionsTable)
      .where(sql`${billingSubscriptionsTable.status} = ANY(${statuses})`);
  }
  return db.select().from(billingSubscriptionsTable);
}

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------

export async function listPaymentMethods(orgId: string): Promise<PaymentMethod[]> {
  return db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.organizationId, orgId))
    .orderBy(desc(paymentMethodsTable.createdAt));
}

export async function getPaymentMethod(id: string): Promise<PaymentMethod | undefined> {
  const [row] = await db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.id, id));
  return row;
}

export async function insertPaymentMethod(data: InsertPaymentMethod): Promise<PaymentMethod> {
  const [row] = await db.insert(paymentMethodsTable).values(data).returning();
  return row!;
}

export async function deletePaymentMethod(id: string, orgId: string): Promise<void> {
  await db.delete(paymentMethodsTable)
    .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.organizationId, orgId)));
}

export async function setDefaultPaymentMethod(id: string, orgId: string): Promise<void> {
  await db.update(paymentMethodsTable)
    .set({ isDefault: false })
    .where(eq(paymentMethodsTable.organizationId, orgId));
  await db.update(paymentMethodsTable)
    .set({ isDefault: true })
    .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.organizationId, orgId)));
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

export async function listInvoices(orgId: string, limit = 20, offset = 0): Promise<Invoice[]> {
  return db.select().from(invoicesTable)
    .where(eq(invoicesTable.organizationId, orgId))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(limit).offset(offset);
}

export async function getInvoice(id: string, orgId: string): Promise<Invoice | undefined> {
  const [row] = await db.select().from(invoicesTable)
    .where(and(eq(invoicesTable.id, id), eq(invoicesTable.organizationId, orgId)));
  return row;
}

export async function upsertInvoice(data: InsertInvoice): Promise<Invoice> {
  const [row] = await db.insert(invoicesTable).values(data)
    .onConflictDoUpdate({ target: invoicesTable.stripeInvoiceId, set: { ...data, updatedAt: new Date() } })
    .returning();
  return row!;
}

// ---------------------------------------------------------------------------
// Usage records
// ---------------------------------------------------------------------------

export async function insertUsageRecord(data: InsertUsageRecord): Promise<UsageRecord> {
  const [row] = await db.insert(usageRecordsTable).values(data).returning();
  return row!;
}

export async function getUsageSince(orgId: string, resourceType: UsageResourceType, since: Date): Promise<number> {
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${usageRecordsTable.quantity}), 0)` })
    .from(usageRecordsTable)
    .where(and(
      eq(usageRecordsTable.organizationId, orgId),
      eq(usageRecordsTable.resourceType, resourceType),
      gte(usageRecordsTable.recordedAt, since),
    ));
  return Number(row?.total ?? 0);
}

export async function getUsageByResource(orgId: string, since: Date): Promise<Record<UsageResourceType, number>> {
  const rows = await db.select({
    resourceType: usageRecordsTable.resourceType,
    total: sql<number>`coalesce(sum(${usageRecordsTable.quantity}), 0)`,
  })
    .from(usageRecordsTable)
    .where(and(
      eq(usageRecordsTable.organizationId, orgId),
      gte(usageRecordsTable.recordedAt, since),
    ))
    .groupBy(usageRecordsTable.resourceType);

  const result: Record<string, number> = {};
  for (const row of rows) result[row.resourceType] = Number(row.total);
  return result as Record<UsageResourceType, number>;
}

// ---------------------------------------------------------------------------
// Usage quotas
// ---------------------------------------------------------------------------

export async function listQuotas(planSlug: string): Promise<UsageQuota[]> {
  return db.select().from(usageQuotasTable)
    .where(eq(usageQuotasTable.planSlug, planSlug));
}

export async function getQuota(planSlug: string, resourceType: UsageResourceType): Promise<UsageQuota | undefined> {
  const [row] = await db.select().from(usageQuotasTable)
    .where(and(eq(usageQuotasTable.planSlug, planSlug), eq(usageQuotasTable.resourceType, resourceType)));
  return row;
}

export async function upsertQuota(data: InsertUsageQuota): Promise<UsageQuota> {
  const [row] = await db.insert(usageQuotasTable).values(data)
    .onConflictDoUpdate({
      target: [usageQuotasTable.planSlug, usageQuotasTable.resourceType],
      set: data,
    })
    .returning();
  return row!;
}

// ---------------------------------------------------------------------------
// Billing events (immutable audit log)
// ---------------------------------------------------------------------------

export async function insertBillingEvent(data: InsertBillingEvent): Promise<BillingEvent> {
  const [row] = await db.insert(billingEventsTable).values(data).returning();
  return row!;
}

export async function listBillingEvents(limit = 50, offset = 0): Promise<BillingEvent[]> {
  return db.select().from(billingEventsTable)
    .orderBy(desc(billingEventsTable.createdAt))
    .limit(limit).offset(offset);
}

export async function markBillingEventProcessed(id: string, error?: string): Promise<void> {
  await db.update(billingEventsTable)
    .set({ status: error ? "failed" : "processed", processedAt: new Date(), error: error ?? null })
    .where(eq(billingEventsTable.id, id));
}

export async function getBillingEventByStripeId(stripeEventId: string): Promise<BillingEvent | undefined> {
  const [row] = await db.select().from(billingEventsTable)
    .where(eq(billingEventsTable.stripeEventId, stripeEventId));
  return row;
}

// ---------------------------------------------------------------------------
// Revenue snapshots
// ---------------------------------------------------------------------------

export async function upsertRevenueSnapshot(data: InsertRevenueSnapshot): Promise<RevenueSnapshot> {
  const [row] = await db.insert(revenueSnapshotsTable).values(data)
    .onConflictDoUpdate({ target: revenueSnapshotsTable.snapshotDate, set: data })
    .returning();
  return row!;
}

export async function listRevenueSnapshots(limit = 30): Promise<RevenueSnapshot[]> {
  return db.select().from(revenueSnapshotsTable)
    .orderBy(desc(revenueSnapshotsTable.snapshotDate))
    .limit(limit);
}

export async function getLatestRevenueSnapshot(): Promise<RevenueSnapshot | undefined> {
  const [row] = await db.select().from(revenueSnapshotsTable)
    .orderBy(desc(revenueSnapshotsTable.snapshotDate))
    .limit(1);
  return row;
}
