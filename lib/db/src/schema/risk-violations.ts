import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Confirmed risk rule violations — a subset of risk events specifically
 * representing a hard limit breach. Stored separately for rapid querying
 * and distinct reporting from softer warnings.
 *
 * Severity: warning | critical
 */
export const riskViolationsTable = pgTable(
  "risk_violations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** The risk rule that was violated (nullable if system-generated) */
    ruleId: uuid("rule_id"),
    ruleType: varchar("rule_type", { length: 50 }).notNull(),
    accountId: uuid("account_id"),
    strategyName: varchar("strategy_name", { length: 100 }),
    /** What limit was breached and by how much */
    description: text("description").notNull(),
    /** warning | critical */
    severity: varchar("severity", { length: 20 }).notNull().default("warning"),
    /** Structured payload: { actualValue, threshold, symbol, ... } */
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_violations_account_idx").on(table.accountId),
    index("risk_violations_rule_type_idx").on(table.ruleType),
    index("risk_violations_severity_idx").on(table.severity),
    index("risk_violations_created_at_idx").on(table.createdAt),
  ],
);

export const insertRiskViolationSchema = createInsertSchema(riskViolationsTable).omit({
  id: true,
  createdAt: true,
});

export const selectRiskViolationSchema = createSelectSchema(riskViolationsTable);

export type InsertRiskViolation = z.infer<typeof insertRiskViolationSchema>;
export type RiskViolation = typeof riskViolationsTable.$inferSelect;
