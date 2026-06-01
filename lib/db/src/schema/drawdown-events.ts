import {
  pgTable,
  uuid,
  varchar,
  numeric,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Drawdown threshold breach events.
 * Created whenever the risk engine detects a drawdown exceeding
 * the configured limit for a given time horizon.
 *
 * Event types: daily_drawdown | weekly_drawdown | account_drawdown | portfolio_drawdown
 * Actions: warning | restriction | halt
 */
export const drawdownEventsTable = pgTable(
  "drawdown_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id").notNull(),
    /** daily_drawdown | weekly_drawdown | account_drawdown | portfolio_drawdown */
    eventType: varchar("event_type", { length: 40 }).notNull(),
    /** Actual drawdown % at the time of the event */
    drawdownPct: numeric("drawdown_pct", { precision: 8, scale: 4 }).notNull(),
    /** Configured threshold that was breached */
    thresholdPct: numeric("threshold_pct", { precision: 8, scale: 4 }).notNull(),
    /** warning | restriction | halt */
    action: varchar("action", { length: 20 }).notNull(),
    /** Whether the drawdown has recovered below threshold */
    resolved: boolean("resolved").notNull().default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("drawdown_events_account_idx").on(table.accountId),
    index("drawdown_events_type_idx").on(table.eventType),
    index("drawdown_events_resolved_idx").on(table.resolved),
    index("drawdown_events_created_at_idx").on(table.createdAt),
  ],
);

export const insertDrawdownEventSchema = createInsertSchema(drawdownEventsTable).omit({
  id: true,
  createdAt: true,
});

export const selectDrawdownEventSchema = createSelectSchema(drawdownEventsTable);

export type InsertDrawdownEvent = z.infer<typeof insertDrawdownEventSchema>;
export type DrawdownEvent = typeof drawdownEventsTable.$inferSelect;
