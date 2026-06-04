import { pgTable, uuid, text, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { billingPlansTable } from "./billing-plans";
import { usageResourceTypeEnum } from "./usage-records";

export const usageQuotasTable = pgTable("usage_quotas", {
  id:              uuid("id").primaryKey().defaultRandom(),
  planSlug:        text("plan_slug").notNull().references(() => billingPlansTable.slug, { onDelete: "cascade" }),
  resourceType:    usageResourceTypeEnum("resource_type").notNull(),
  limitPerDay:     integer("limit_per_day"),
  limitPerMonth:   integer("limit_per_month"),
  isHardLimit:     boolean("is_hard_limit").notNull().default(false),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("usage_quotas_plan_resource_uidx").on(t.planSlug, t.resourceType),
]);

export type UsageQuota     = typeof usageQuotasTable.$inferSelect;
export type InsertUsageQuota = typeof usageQuotasTable.$inferInsert;
