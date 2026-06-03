import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * alert_rules — configurable alert rule definitions.
 * Each rule defines when an alert fires, at what severity, and how often.
 */
export const alertRulesTable = pgTable(
  "alert_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Machine-readable rule name e.g. high_drawdown, stream_disconnected */
    name: varchar("name", { length: 100 }).notNull().unique(),
    /** Human-readable display name */
    displayName: varchar("display_name", { length: 200 }).notNull(),
    /** Rule category: system | scheduler | strategy | ai | execution | stream | risk | data */
    category: varchar("category", { length: 50 }).notNull(),
    /** warning | critical | emergency */
    severity: varchar("severity", { length: 20 }).notNull(),
    /** What metric triggers this rule */
    condition: varchar("condition", { length: 500 }).notNull(),
    /** Threshold value for the condition (numeric) */
    threshold: numeric("threshold", { precision: 12, scale: 4 }),
    /** Minimum minutes between repeated alerts for this rule (cooldown) */
    cooldownMinutes: integer("cooldown_minutes").notNull().default(60),
    /** Whether this rule is currently active */
    isEnabled: boolean("is_enabled").notNull().default(true),
    /** Human-readable description of what the rule detects */
    description: varchar("description", { length: 1000 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("alert_rules_category_idx").on(table.category),
    index("alert_rules_severity_idx").on(table.severity),
    index("alert_rules_enabled_idx").on(table.isEnabled),
  ],
);

export const insertAlertRulesSchema = createInsertSchema(alertRulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectAlertRulesSchema = createSelectSchema(alertRulesTable);

export type InsertAlertRule = z.infer<typeof insertAlertRulesSchema>;
export type AlertRule = typeof alertRulesTable.$inferSelect;
