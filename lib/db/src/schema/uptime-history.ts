import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * uptime_history — service uptime state change records.
 * Each row represents a period where a service was in a particular state.
 * When status changes, the current row's fromTime is recorded; a new row opens.
 */
export const uptimeHistoryTable = pgTable(
  "uptime_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Service name */
    service: varchar("service", { length: 80 }).notNull(),
    /** up | down | degraded | maintenance */
    status: varchar("status", { length: 20 }).notNull(),
    /** When this status period started */
    fromTime: timestamp("from_time", { withTimezone: true }).notNull(),
    /** When this status period ended (null = still in this state) */
    toTime: timestamp("to_time", { withTimezone: true }),
    /** Duration of this status period in seconds (null if still open) */
    durationSeconds: numeric("duration_seconds", { precision: 12, scale: 0 }),
    /** What caused the status change */
    reason: varchar("reason", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("uptime_history_service_idx").on(table.service),
    index("uptime_history_service_from_idx").on(table.service, table.fromTime),
    index("uptime_history_status_idx").on(table.status),
  ],
);

export const insertUptimeHistorySchema = createInsertSchema(uptimeHistoryTable).omit({
  id: true,
  createdAt: true,
});
export const selectUptimeHistorySchema = createSelectSchema(uptimeHistoryTable);

export type InsertUptimeHistory = z.infer<typeof insertUptimeHistorySchema>;
export type UptimeHistory = typeof uptimeHistoryTable.$inferSelect;
