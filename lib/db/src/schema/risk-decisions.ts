import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Immutable record of every pre-trade risk decision.
 * Every order attempt is recorded here regardless of outcome.
 * Never deleted — full audit trail.
 *
 * Decision: approved | rejected | requires_review
 */
export const riskDecisionsTable = pgTable(
  "risk_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Paper account being checked */
    accountId: uuid("account_id"),
    /** Strategy assignment that triggered the order */
    strategyAssignmentId: uuid("strategy_assignment_id"),
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Instrument being traded */
    symbol: varchar("symbol", { length: 30 }).notNull(),
    /** buy | sell */
    side: varchar("side", { length: 10 }).notNull(),
    /** Requested quantity */
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull(),
    /** Estimated notional value at time of check */
    notional: numeric("notional", { precision: 20, scale: 8 }),
    /** approved | rejected | requires_review */
    decision: varchar("decision", { length: 20 }).notNull(),
    /** Composite risk score 0–100 (lower = safer) */
    riskScore: numeric("risk_score", { precision: 6, scale: 2 }),
    /** Human-readable reason for the decision */
    reason: text("reason"),
    /** Array of rule names/types that fired */
    triggeredRules: jsonb("triggered_rules"),
    /** Risk profile applied at evaluation time */
    profileId: uuid("profile_id"),
    profileName: varchar("profile_name", { length: 100 }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_decisions_account_idx").on(table.accountId),
    index("risk_decisions_decision_idx").on(table.decision),
    index("risk_decisions_symbol_idx").on(table.symbol),
    index("risk_decisions_evaluated_at_idx").on(table.evaluatedAt),
    index("risk_decisions_strategy_idx").on(table.strategyName),
  ],
);

export const insertRiskDecisionSchema = createInsertSchema(riskDecisionsTable).omit({
  id: true,
  createdAt: true,
  evaluatedAt: true,
});

export const selectRiskDecisionSchema = createSelectSchema(riskDecisionsTable);

export type InsertRiskDecision = z.infer<typeof insertRiskDecisionSchema>;
export type RiskDecision = typeof riskDecisionsTable.$inferSelect;
