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
 * Immutable risk system audit log.
 * Records every significant risk action: profile changes, rule updates,
 * kill switch operations, circuit breaker state changes, and decision overrides.
 * Never deleted. Append-only.
 *
 * Result: success | failure | skipped
 */
export const riskAuditLogTable = pgTable(
  "risk_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Who performed the action: "system" | "scheduler" | "api" */
    actor: varchar("actor", { length: 50 }).notNull().default("system"),
    /** What was done: "kill_switch.activate", "profile.create", "circuit_breaker.trigger" */
    action: varchar("action", { length: 100 }).notNull(),
    /** Type of entity affected: "profile" | "rule" | "account" | "strategy" | "circuit_breaker" */
    entityType: varchar("entity_type", { length: 50 }),
    /** ID of the affected entity */
    entityId: varchar("entity_id", { length: 100 }),
    /** Structured context payload */
    payload: jsonb("payload"),
    /** success | failure | skipped */
    result: varchar("result", { length: 20 }).notNull().default("success"),
    /** Error message if result = failure */
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_audit_log_actor_idx").on(table.actor),
    index("risk_audit_log_action_idx").on(table.action),
    index("risk_audit_log_entity_type_idx").on(table.entityType),
    index("risk_audit_log_created_at_idx").on(table.createdAt),
  ],
);

export const insertRiskAuditLogSchema = createInsertSchema(riskAuditLogTable).omit({
  id: true,
  createdAt: true,
});

export const selectRiskAuditLogSchema = createSelectSchema(riskAuditLogTable);

export type InsertRiskAuditLog = z.infer<typeof insertRiskAuditLogSchema>;
export type RiskAuditLog = typeof riskAuditLogTable.$inferSelect;
