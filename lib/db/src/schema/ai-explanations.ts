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
 * ai_explanations — targeted AI explanations of specific platform events.
 * When a risk violation, drawdown event, circuit breaker, or kill switch fires,
 * an explanation record can be generated describing what happened and why in
 * plain English.
 *
 * Entity types: risk_event | drawdown_event | circuit_breaker | kill_switch |
 *               performance_decline | health_score | recommendation | backtest_result
 */
export const aiExplanationsTable = pgTable(
  "ai_explanations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Type of entity being explained */
    entityType: varchar("entity_type", { length: 50 }).notNull(),
    /** ID of the entity being explained */
    entityId: varchar("entity_id", { length: 100 }),
    /** Short title */
    title: varchar("title", { length: 255 }).notNull(),
    /** Full explanation (plain English, markdown) */
    explanation: text("explanation").notNull(),
    /** Account ID if explanation is account-scoped */
    accountId: uuid("account_id"),
    /** Raw event data that was explained */
    eventData: jsonb("event_data"),
    /** Context snapshot used */
    contextSnapshotId: uuid("context_snapshot_id"),
    /** Provider used */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    /** Model used */
    model: varchar("model", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_explanations_entity_type_idx").on(table.entityType),
    index("ai_explanations_entity_id_idx").on(table.entityId),
    index("ai_explanations_account_idx").on(table.accountId),
    index("ai_explanations_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiExplanationSchema = createInsertSchema(aiExplanationsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiExplanationSchema = createSelectSchema(aiExplanationsTable);

export type InsertAiExplanation = z.infer<typeof insertAiExplanationSchema>;
export type AiExplanation = typeof aiExplanationsTable.$inferSelect;
