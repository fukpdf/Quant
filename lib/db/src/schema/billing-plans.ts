import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export const billingPlansTable = pgTable("billing_plans", {
  slug:                 text("slug").primaryKey(),
  name:                 text("name").notNull(),
  description:          text("description").notNull(),
  priceMonthlyUsd:      integer("price_monthly_usd").notNull().default(0),
  priceYearlyUsd:       integer("price_yearly_usd").notNull().default(0),
  stripePriceMonthly:   text("stripe_price_monthly"),
  stripePriceYearly:    text("stripe_price_yearly"),
  apiRequestsPerDay:    integer("api_requests_per_day"),
  backtestsPerMonth:    integer("backtests_per_month"),
  aiTokensPerMonth:     integer("ai_tokens_per_month").notNull().default(0),
  streamConnections:    integer("stream_connections").notNull().default(1),
  maxOrgMembers:        integer("max_org_members").notNull().default(1),
  maxApiKeys:           integer("max_api_keys").notNull().default(1),
  features:             jsonb("features").$type<Record<string, boolean>>().notNull().default({}),
  isPublic:             boolean("is_public").notNull().default(true),
  isActive:             boolean("is_active").notNull().default(true),
  sortOrder:            integer("sort_order").notNull().default(0),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingPlan    = typeof billingPlansTable.$inferSelect;
export type InsertBillingPlan = typeof billingPlansTable.$inferInsert;
