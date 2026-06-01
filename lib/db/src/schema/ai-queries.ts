import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_queries — individual question/answer pairs within a conversation.
 * Each query stores the raw prompt, the structured response, token counts,
 * and a reference to the context snapshot used to answer the question.
 * Immutable once inserted — never updated.
 */
export const aiQueriesTable = pgTable(
  "ai_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id").notNull(),
    /** Turn index within the conversation (1-based) */
    turnIndex: integer("turn_index").notNull().default(1),
    /** Raw question text submitted by the user */
    prompt: text("prompt").notNull(),
    /** Full AI response text */
    response: text("response"),
    /** ID of the context snapshot used for this query */
    contextSnapshotId: uuid("context_snapshot_id"),
    /** Provider that handled this query */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    /** Model used */
    model: varchar("model", { length: 100 }),
    /** Token counts from the provider response */
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    /** Latency in milliseconds for the LLM call */
    latencyMs: integer("latency_ms"),
    /** success | failure | timeout */
    status: varchar("status", { length: 20 }).notNull().default("success"),
    /** Error details if status = failure */
    errorMessage: text("error_message"),
    /** Structured data extracted from the response if any */
    structuredData: jsonb("structured_data"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_queries_conversation_idx").on(table.conversationId),
    index("ai_queries_created_at_idx").on(table.createdAt),
    index("ai_queries_provider_idx").on(table.provider),
  ],
);

export const insertAiQuerySchema = createInsertSchema(aiQueriesTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiQuerySchema = createSelectSchema(aiQueriesTable);

export type InsertAiQuery = z.infer<typeof insertAiQuerySchema>;
export type AiQuery = typeof aiQueriesTable.$inferSelect;
