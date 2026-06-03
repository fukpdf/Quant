import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  text,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiResearchJobsTable } from "./ai-research-jobs";

/**
 * ai_research_findings — structured findings produced by AI research jobs.
 *
 * Each job can produce multiple findings. Findings are advisory-only —
 * they surface information for human decision-making.
 *
 * finding_type: insight | recommendation | warning | overfitting | parameter_change | regime_alert
 * severity: info | warning | critical
 */
export const aiResearchFindingsTable = pgTable(
  "ai_research_findings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Job that produced this finding */
    jobId: uuid("job_id")
      .notNull()
      .references(() => aiResearchJobsTable.id),
    /** insight | recommendation | warning | overfitting | parameter_change | regime_alert */
    findingType: varchar("finding_type", { length: 30 }).notNull(),
    /** info | warning | critical */
    severity: varchar("severity", { length: 10 }).notNull().default("info"),
    /** Short title summarizing the finding */
    title: text("title").notNull(),
    /** Detailed explanation of the finding */
    description: text("description").notNull(),
    /** Supporting data, metrics, or analysis { key: value } */
    evidence: jsonb("evidence").notNull().default({}),
    /** Concrete next steps the operator could take */
    suggestedActions: jsonb("suggested_actions").notNull().default([]),
    /** Strategy this finding pertains to (null = portfolio-level) */
    strategyName: varchar("strategy_name", { length: 100 }),
    /** Confidence score in this finding 0–1 */
    confidenceScore: varchar("confidence_score", { length: 10 }),
    /** Has the operator acknowledged this finding */
    isAcknowledged: boolean("is_acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    /** If this finding triggered an optimization run */
    linkedOptimizationRunId: uuid("linked_optimization_run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("ai_findings_job_id_idx").on(table.jobId),
    index("ai_findings_type_idx").on(table.findingType),
    index("ai_findings_severity_idx").on(table.severity),
    index("ai_findings_strategy_name_idx").on(table.strategyName),
    index("ai_findings_acknowledged_idx").on(table.isAcknowledged),
    index("ai_findings_created_at_idx").on(table.createdAt),
  ],
);

export const insertAiResearchFindingSchema = createInsertSchema(aiResearchFindingsTable).omit({
  id: true,
  createdAt: true,
});

export const selectAiResearchFindingSchema = createSelectSchema(aiResearchFindingsTable);

export type InsertAiResearchFinding = z.infer<typeof insertAiResearchFindingSchema>;
export type AiResearchFinding = typeof aiResearchFindingsTable.$inferSelect;
