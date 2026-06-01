import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Operational risk events — anything noteworthy from the risk monitoring layer.
 *
 * Event types: drawdown_warning | drawdown_restriction | drawdown_halt |
 *   exposure_breach | concentration_breach | circuit_breaker_triggered |
 *   kill_switch_activated | data_staleness | execution_risk | strategy_degradation
 *
 * Severity: info | warning | critical
 */
export const riskEventsTable = pgTable(
  "risk_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id"),
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Categorical event type */
    eventType: varchar("event_type", { length: 60 }).notNull(),
    /** info | warning | critical */
    severity: varchar("severity", { length: 20 }).notNull().default("info"),
    /** Human-readable message */
    message: text("message").notNull(),
    /** Structured payload for machine consumption */
    payload: jsonb("payload"),
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_events_account_idx").on(table.accountId),
    index("risk_events_type_idx").on(table.eventType),
    index("risk_events_severity_idx").on(table.severity),
    index("risk_events_resolved_idx").on(table.resolved),
    index("risk_events_created_at_idx").on(table.createdAt),
  ],
);

export const insertRiskEventSchema = createInsertSchema(riskEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectRiskEventSchema = createSelectSchema(riskEventsTable);

export type InsertRiskEvent = z.infer<typeof insertRiskEventSchema>;
export type RiskEvent = typeof riskEventsTable.$inferSelect;
