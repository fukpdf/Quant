import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * ai_research_jobs — autonomous AI research task queue.
 *
 * The ResearchCoordinator dispatches jobs to the AIOptimizationAssistant.
 * Jobs are advisory-only — they produce findings but cannot execute trades.
 *
 * job_type:
 *   strategy_analysis       — deep dive into a strategy's performance profile
 *   optimization_recommendation — suggest better parameter ranges
 *   regime_adaptation       — advise on strategy suitability for current regime
 *   parameter_suggestion    — recommend specific parameter changes
 *   overfitting_detection   — identify signs of in-sample overfitting
 *   portfolio_review        — assess current portfolio allocation
 *   comparative_analysis    — compare two or more strategies
 *
 * status: pending | running | completed | failed | cancelled
 * priority: low | medium | high | critical
 */
export const aiResearchJobsTable = pgTable(
  "ai_research_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** What kind of research task */
    jobType: varchar("job_type", { length: 50 }).notNull(),
    /** Primary strategy name this job concerns (null for portfolio-level jobs) */
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Additional input parameters { symbol, timeframe, backtest_run_id, ... } */
    inputParameters: jsonb("input_parameters").notNull().default({}),
    /** pending | running | completed | failed | cancelled */
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    /** low | medium | high | critical */
    priority: varchar("priority", { length: 10 }).notNull().default("medium"),
    /** AI provider used: openai | anthropic | gemini | mock */
    providerUsed: varchar("provider_used", { length: 20 }),
    /** Model used for this job */
    modelUsed: varchar("model_used", { length: 50 }),
    /** Tokens consumed by this job */
    tokensUsed: varchar("tokens_used", { length: 20 }),
    /** Structured JSON result from the AI analysis */
    result: jsonb("result"),
    /** Raw AI response text */
    rawResponse: text("raw_response"),
    /** Error message if status = failed */
    errorMessage: text("error_message"),
    /** When to run this job (null = run immediately) */
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    /** Linked optimization run this job was triggered by */
    optimizationRunId: uuid("optimization_run_id"),
    /** Linked regime ID this job was triggered by */
    regimeId: uuid("regime_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_research_jobs_status_idx").on(table.status),
    index("ai_research_jobs_priority_idx").on(table.priority),
    index("ai_research_jobs_job_type_idx").on(table.jobType),
    index("ai_research_jobs_strategy_name_idx").on(table.strategyName),
    index("ai_research_jobs_scheduled_at_idx").on(table.scheduledAt),
    index("ai_research_jobs_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiResearchJobSchema = createInsertSchema(aiResearchJobsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectAiResearchJobSchema = createSelectSchema(aiResearchJobsTable);

export type InsertAiResearchJob = z.infer<typeof insertAiResearchJobSchema>;
export type AiResearchJob = typeof aiResearchJobsTable.$inferSelect;
