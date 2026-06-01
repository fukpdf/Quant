import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_audit_log — immutable audit trail for every AI system interaction.
 * Logs every prompt, response, context source, user, and resource usage.
 * Never deleted. Append-only. Required for auditability and safety.
 *
 * Action types: chat.query | report.generate | insight.generate |
 *               summary.generate | explanation.generate | comparison.run |
 *               context.snapshot | recommendation.explain
 */
export const aiAuditLogTable = pgTable(
  "ai_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Who triggered the action */
    actor: varchar("actor", { length: 50 }).notNull().default("user"),
    /** Action type */
    action: varchar("action", { length: 100 }).notNull(),
    /** Account ID if action is account-scoped */
    accountId: uuid("account_id"),
    /** Conversation ID if applicable */
    conversationId: uuid("conversation_id"),
    /** Report ID if applicable */
    reportId: uuid("report_id"),
    /** Short prompt summary (not the full prompt for privacy) */
    promptSummary: varchar("prompt_summary", { length: 500 }),
    /** Full prompt text (for complete auditability) */
    promptFull: text("prompt_full"),
    /** Response summary */
    responseSummary: varchar("response_summary", { length: 500 }),
    /** Context domains that were included */
    contextDomains: jsonb("context_domains").$type<string[]>().default([]),
    /** Provider used */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    /** Model used */
    model: varchar("model", { length: 100 }),
    /** Token usage */
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    /** Latency in ms */
    latencyMs: integer("latency_ms"),
    /** success | failure | rejected */
    result: varchar("result", { length: 20 }).notNull().default("success"),
    /** Error if result = failure */
    errorMessage: text("error_message"),
    /** Additional metadata */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_audit_log_action_idx").on(table.action),
    index("ai_audit_log_account_idx").on(table.accountId),
    index("ai_audit_log_actor_idx").on(table.actor),
    index("ai_audit_log_created_at_idx").on(table.createdAt),
    index("ai_audit_log_result_idx").on(table.result),
  ],
);

export const insertAiAuditLogSchema = createInsertSchema(aiAuditLogTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiAuditLogSchema = createSelectSchema(aiAuditLogTable);

export type InsertAiAuditLog = z.infer<typeof insertAiAuditLogSchema>;
export type AiAuditLog = typeof aiAuditLogTable.$inferSelect;
