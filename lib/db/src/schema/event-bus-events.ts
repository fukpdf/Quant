import {
  pgTable,
  uuid,
  varchar,
  jsonb,
  boolean,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * event_bus_events — persistent audit log of all events passing through the internal event bus.
 * Not every tick is logged (too high volume); key lifecycle and state-change events are.
 * TickReceived events are sampled (1 in N) to avoid DB saturation.
 */
export const eventBusEventsTable = pgTable(
  "event_bus_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Event type enum */
    eventType: varchar("event_type", { length: 80 }).notNull(),
    /** Source component that emitted the event */
    source: varchar("source", { length: 100 }).notNull(),
    /** Payload — type-specific JSON */
    payload: jsonb("payload"),
    /** Symbol if event is symbol-scoped */
    symbol: varchar("symbol", { length: 20 }),
    /** Provider if event is provider-scoped */
    provider: varchar("provider", { length: 50 }),
    /** Session that generated this event */
    sessionId: uuid("session_id"),
    /** Whether this event triggered a downstream action */
    actionTriggered: boolean("action_triggered").default(false),
    /** Number of subscribers that received this event */
    subscriberCount: numeric("subscriber_count", { precision: 5, scale: 0 }).default("0"),
    /** Processing time from emit to all handlers completing (ms) */
    processingMs: numeric("processing_ms", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("event_bus_type_idx").on(table.eventType),
    index("event_bus_symbol_idx").on(table.symbol),
    index("event_bus_created_idx").on(table.createdAt),
    index("event_bus_session_idx").on(table.sessionId),
  ],
);

export const insertEventBusEventSchema = createInsertSchema(eventBusEventsTable).omit({
  id: true,
  createdAt: true,
});
export const selectEventBusEventSchema = createSelectSchema(eventBusEventsTable);

export type InsertEventBusEvent = z.infer<typeof insertEventBusEventSchema>;
export type EventBusEvent = typeof eventBusEventsTable.$inferSelect;
