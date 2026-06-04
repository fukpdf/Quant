import { pgTable, uuid, integer, date, timestamp } from "drizzle-orm/pg-core";

export const revenueSnapshotsTable = pgTable("revenue_snapshots", {
  id:                     uuid("id").primaryKey().defaultRandom(),
  snapshotDate:           date("snapshot_date").notNull().unique(),
  mrrCents:               integer("mrr_cents").notNull().default(0),
  arrCents:               integer("arr_cents").notNull().default(0),
  newMrrCents:            integer("new_mrr_cents").notNull().default(0),
  churnMrrCents:          integer("churn_mrr_cents").notNull().default(0),
  expansionMrrCents:      integer("expansion_mrr_cents").notNull().default(0),
  activeSubscriptions:    integer("active_subscriptions").notNull().default(0),
  trialSubscriptions:     integer("trial_subscriptions").notNull().default(0),
  churnedCount:           integer("churned_count").notNull().default(0),
  newCount:               integer("new_count").notNull().default(0),
  conversionRate:         integer("conversion_rate_bps").notNull().default(0),
  createdAt:              timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RevenueSnapshot    = typeof revenueSnapshotsTable.$inferSelect;
export type InsertRevenueSnapshot = typeof revenueSnapshotsTable.$inferInsert;
