import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { riskProfilesTable } from "./risk-profiles";

/**
 * Individual risk rules attached to a risk profile.
 * Each rule is evaluated independently during pre-trade risk checks.
 *
 * Rule types: position_size | portfolio_exposure | daily_loss |
 *   drawdown | concentration | strategy_confidence | data_freshness |
 *   account_status | market_availability | open_positions_limit
 */
export const riskRulesTable = pgTable(
  "risk_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => riskProfilesTable.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    /** Categorical rule type — drives evaluation logic */
    ruleType: varchar("rule_type", { length: 50 }).notNull(),
    description: text("description"),
    /** JSON blob of rule-specific parameters, e.g. { "threshold": 10 } */
    params: jsonb("params"),
    /** Lower priority value = evaluated first */
    priority: integer("priority").notNull().default(100),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("risk_rules_profile_idx").on(table.profileId),
    index("risk_rules_type_idx").on(table.ruleType),
    index("risk_rules_enabled_idx").on(table.isEnabled),
  ],
);

export const insertRiskRuleSchema = createInsertSchema(riskRulesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectRiskRuleSchema = createSelectSchema(riskRulesTable);

export type InsertRiskRule = z.infer<typeof insertRiskRuleSchema>;
export type RiskRule = typeof riskRulesTable.$inferSelect;
