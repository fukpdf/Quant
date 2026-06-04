import { pgTable, uuid, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const billingEventStatusEnum = pgEnum("billing_event_status", [
  "pending", "processed", "failed", "ignored",
]);

export const billingEventsTable = pgTable("billing_events", {
  id:              uuid("id").primaryKey().defaultRandom(),
  stripeEventId:   text("stripe_event_id").unique(),
  eventType:       text("event_type").notNull(),
  organizationId:  uuid("organization_id"),
  payload:         jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status:          billingEventStatusEnum("status").notNull().default("pending"),
  processedAt:     timestamp("processed_at", { withTimezone: true }),
  error:           text("error"),
  createdAt:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingEvent    = typeof billingEventsTable.$inferSelect;
export type InsertBillingEvent = typeof billingEventsTable.$inferInsert;
