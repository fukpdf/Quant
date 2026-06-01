import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Circuit breaker state change events.
 * One row per state transition (active → triggered → recovering → active, etc.)
 *
 * Breaker types:
 *   loss_streak         — N consecutive losing trades
 *   drawdown            — drawdown exceeds threshold
 *   execution_failure   — N consecutive fill failures
 *   volatility          — market volatility exceeds threshold
 *   data_failure        — data staleness / missing candles
 *   market_closure      — market detected as closed
 *
 * States: active | triggered | recovering | disabled
 */
export const circuitBreakerEventsTable = pgTable(
  "circuit_breaker_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** loss_streak | drawdown | execution_failure | volatility | data_failure | market_closure */
    breakerType: varchar("breaker_type", { length: 40 }).notNull(),
    /** active | triggered | recovering | disabled */
    state: varchar("state", { length: 20 }).notNull(),
    accountId: uuid("account_id"),
    strategyName: varchar("strategy_name", { length: 100 }),
    /** The metric value that caused the trigger (e.g. drawdown %) */
    triggeredValue: numeric("triggered_value", { precision: 12, scale: 4 }),
    /** The threshold that was breached */
    threshold: numeric("threshold", { precision: 12, scale: 4 }),
    reason: text("reason"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }),
    recoveredAt: timestamp("recovered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("circuit_breaker_events_type_idx").on(table.breakerType),
    index("circuit_breaker_events_state_idx").on(table.state),
    index("circuit_breaker_events_account_idx").on(table.accountId),
    index("circuit_breaker_events_created_at_idx").on(table.createdAt),
  ],
);

export const insertCircuitBreakerEventSchema = createInsertSchema(circuitBreakerEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectCircuitBreakerEventSchema = createSelectSchema(circuitBreakerEventsTable);

export type InsertCircuitBreakerEvent = z.infer<typeof insertCircuitBreakerEventSchema>;
export type CircuitBreakerEvent = typeof circuitBreakerEventsTable.$inferSelect;
