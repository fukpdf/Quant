import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const billingCustomersTable = pgTable("billing_customers", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  organizationId:       uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }).unique(),
  stripeCustomerId:     text("stripe_customer_id").unique(),
  stripeMetadata:       jsonb("stripe_metadata").$type<Record<string, unknown>>().default({}),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BillingCustomer    = typeof billingCustomersTable.$inferSelect;
export type InsertBillingCustomer = typeof billingCustomersTable.$inferInsert;
