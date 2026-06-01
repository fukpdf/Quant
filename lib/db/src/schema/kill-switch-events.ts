import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Kill switch activations and resumptions.
 * Every kill switch operation is immutably recorded here.
 *
 * Scope: strategy | account | portfolio | trading | scheduler
 * Action: activate | resume
 */
export const killSwitchEventsTable = pgTable(
  "kill_switch_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** strategy | account | portfolio | trading | scheduler */
    scope: varchar("scope", { length: 20 }).notNull(),
    /** activate | resume */
    action: varchar("action", { length: 20 }).notNull(),
    /** For strategy scope: strategyName; for account scope: accountId */
    targetId: varchar("target_id", { length: 100 }),
    /** Human-readable label for the target */
    targetLabel: varchar("target_label", { length: 200 }),
    /** Required reason for audit trail */
    reason: text("reason").notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    resumedAt: timestamp("resumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("kill_switch_events_scope_idx").on(table.scope),
    index("kill_switch_events_action_idx").on(table.action),
    index("kill_switch_events_created_at_idx").on(table.createdAt),
  ],
);

export const insertKillSwitchEventSchema = createInsertSchema(killSwitchEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectKillSwitchEventSchema = createSelectSchema(killSwitchEventsTable);

export type InsertKillSwitchEvent = z.infer<typeof insertKillSwitchEventSchema>;
export type KillSwitchEvent = typeof killSwitchEventsTable.$inferSelect;
