import { pgTable, uuid, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const paymentMethodsTable = pgTable("payment_methods", {
  id:                       uuid("id").primaryKey().defaultRandom(),
  organizationId:           uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  stripePaymentMethodId:    text("stripe_payment_method_id").notNull().unique(),
  type:                     text("type").notNull().default("card"),
  brand:                    text("brand"),
  last4:                    text("last4"),
  expMonth:                 integer("exp_month"),
  expYear:                  integer("exp_year"),
  isDefault:                boolean("is_default").notNull().default(false),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentMethod    = typeof paymentMethodsTable.$inferSelect;
export type InsertPaymentMethod = typeof paymentMethodsTable.$inferInsert;
