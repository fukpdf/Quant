import {
  pgTable,
  uuid,
  varchar,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_health — AI system health snapshot per provider per window.
 * Tracks requests, tokens, failures, latency, and availability rate.
 */
export const aiHealthTable = pgTable(
  "ai_health",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Provider name: openai | anthropic | gemini | mock */
    provider: varchar("provider", { length: 50 }).notNull(),
    /** Window identifier: 1h | 4h | 1d */
    window: varchar("window", { length: 10 }).notNull(),
    /** healthy | degraded | unavailable */
    status: varchar("status", { length: 30 }).notNull().default("healthy"),
    /** Health score 0–100 */
    healthScore: numeric("health_score", { precision: 5, scale: 1 }),
    /** Total requests in window */
    totalRequests: integer("total_requests").notNull().default(0),
    /** Total tokens consumed in window */
    totalTokens: integer("total_tokens").notNull().default(0),
    /** Failed requests in window */
    failureCount: integer("failure_count").notNull().default(0),
    /** Average response latency ms */
    avgLatencyMs: numeric("avg_latency_ms", { precision: 10, scale: 2 }),
    /** p95 response latency ms */
    p95LatencyMs: numeric("p95_latency_ms", { precision: 10, scale: 2 }),
    /** Availability rate 0.0–1.0 (1 - failure_count / total_requests) */
    availabilityRate: numeric("availability_rate", { precision: 5, scale: 4 }),
    /** Failure rate 0.0–1.0 */
    failureRate: numeric("failure_rate", { precision: 5, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_health_provider_idx").on(table.provider),
    index("ai_health_created_idx").on(table.createdAt),
    index("ai_health_provider_window_idx").on(table.provider, table.window),
  ],
);

export const insertAiHealthSchema = createInsertSchema(aiHealthTable).omit({
  id: true,
  createdAt: true,
});
export const selectAiHealthSchema = createSelectSchema(aiHealthTable);

export type InsertAiHealth = z.infer<typeof insertAiHealthSchema>;
export type AiHealth = typeof aiHealthTable.$inferSelect;
