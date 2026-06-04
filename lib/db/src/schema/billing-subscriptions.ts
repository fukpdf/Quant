import { pgTable, uuid, text, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { billingPlansTable } from "./billing-plans";

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "trialing", "past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused",
]);

export const billingSubscriptionsTable = pgTable("billing_subscriptions", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  organizationId:         uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }).unique(),
  planSlug:               text("plan_slug").notNull().references(() => billingPlansTable.slug),
  stripeSubscriptionId:   text("stripe_subscription_id").unique(),
  stripeItemId:           text("stripe_item_id"),
  status:                 subscriptionStatusEnum("status").notNull().default("active"),
  currentPeriodStart:     timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd:       timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd:      boolean("cancel_at_period_end").notNull().default(false),
  canceledAt:             timestamp("canceled_at", { withTimezone: true }),
  trialStart:             timestamp("trial_start", { withTimezone: true }),
  trialEnd:               timestamp("trial_end", { withTimezone: true }),
  metadata:               text("metadata"),
  createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:              timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingSubscription    = typeof billingSubscriptionsTable.$inferSelect;
export type InsertBillingSubscription = typeof billingSubscriptionsTable.$inferInsert;
