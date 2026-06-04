import { pgTable, uuid, text, integer, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organizationsTable } from "./organizations";
import { usersTable } from "./users";

export const usageResourceTypeEnum = pgEnum("usage_resource_type", [
  "api_requests", "ai_tokens", "backtest_runs", "research_jobs", "stream_subscriptions",
]);

export const usageRecordsTable = pgTable("usage_records", {
  id:             uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizationsTable.id, { onDelete: "cascade" }),
  userId:         uuid("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  resourceType:   usageResourceTypeEnum("resource_type").notNull(),
  quantity:       integer("quantity").notNull().default(1),
  recordedAt:     timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  metadata:       jsonb("metadata").$type<Record<string, unknown>>().default({}),
}, (t) => [
  index("idx_usage_records_org_resource").on(t.organizationId, t.resourceType),
  index("idx_usage_records_recorded_at").on(t.recordedAt),
]);

export type UsageRecord    = typeof usageRecordsTable.$inferSelect;
export type InsertUsageRecord = typeof usageRecordsTable.$inferInsert;
