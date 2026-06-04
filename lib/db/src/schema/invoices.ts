import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";

export const invoicesTable = pgTable("invoices", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  organizationId:       uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  stripeInvoiceId:      text("stripe_invoice_id").notNull().unique(),
  amountDueCents:       integer("amount_due_cents").notNull().default(0),
  amountPaidCents:      integer("amount_paid_cents").notNull().default(0),
  currency:             text("currency").notNull().default("usd"),
  status:               text("status").notNull().default("draft"),
  description:          text("description"),
  invoicePdfUrl:        text("invoice_pdf_url"),
  hostedInvoiceUrl:     text("hosted_invoice_url"),
  periodStart:          timestamp("period_start", { withTimezone: true }),
  periodEnd:            timestamp("period_end", { withTimezone: true }),
  dueDate:              timestamp("due_date", { withTimezone: true }),
  paidAt:               timestamp("paid_at", { withTimezone: true }),
  createdAt:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Invoice    = typeof invoicesTable.$inferSelect;
export type InsertInvoice = typeof invoicesTable.$inferInsert;
