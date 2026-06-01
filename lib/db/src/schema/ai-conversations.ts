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
 * ai_conversations — persistent conversation sessions with the AI assistant.
 * Each session tracks the chain of queries and responses along with
 * the aggregate context sources that were referenced.
 * Sessions are immutable once closed — no messages are deleted.
 */
export const aiConversationsTable = pgTable(
  "ai_conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable title derived from the first query */
    title: varchar("title", { length: 255 }),
    /** Session actor: "user" | "system" */
    actor: varchar("actor", { length: 50 }).notNull().default("user"),
    /** open | closed */
    status: varchar("status", { length: 20 }).notNull().default("open"),
    /** Account ID if conversation is scoped to an account */
    accountId: uuid("account_id"),
    /** Provider used for this conversation (openai | anthropic | gemini | mock) */
    provider: varchar("provider", { length: 50 }).notNull().default("mock"),
    /** Model identifier e.g. "gpt-4o", "claude-3-5-sonnet" */
    model: varchar("model", { length: 100 }),
    /** Cumulative token usage for the entire session */
    totalPromptTokens: varchar("total_prompt_tokens", { length: 20 }).notNull().default("0"),
    totalCompletionTokens: varchar("total_completion_tokens", { length: 20 }).notNull().default("0"),
    /** Number of queries in this conversation */
    queryCount: varchar("query_count", { length: 10 }).notNull().default("0"),
    /** High-level topics referenced: ["portfolio", "risk", "strategy", "benchmark"] */
    contextDomains: jsonb("context_domains").$type<string[]>().default([]),
    /** Arbitrary metadata */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (table) => [
    index("ai_conversations_status_idx").on(table.status),
    index("ai_conversations_account_idx").on(table.accountId),
    index("ai_conversations_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiConversationSchema = createInsertSchema(aiConversationsTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiConversationSchema = createSelectSchema(aiConversationsTable);

export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type AiConversation = typeof aiConversationsTable.$inferSelect;
