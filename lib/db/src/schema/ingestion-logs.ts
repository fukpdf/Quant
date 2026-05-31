import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ingestionLogsTable = pgTable(
  "ingestion_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 100 }).notNull(),
    symbol: varchar("symbol", { length: 30 }),
    interval: varchar("interval", { length: 10 }),
    status: varchar("status", { length: 20 }).notNull(),
    candlesFetched: integer("candles_fetched"),
    candlesInserted: integer("candles_inserted"),
    errorMessage: text("error_message"),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ingestion_logs_source_idx").on(table.source),
    index("ingestion_logs_created_at_idx").on(table.createdAt),
  ],
);

export const insertIngestionLogSchema = createInsertSchema(
  ingestionLogsTable,
).omit({ id: true, createdAt: true });

export const selectIngestionLogSchema = createSelectSchema(ingestionLogsTable);

export type InsertIngestionLog = z.infer<typeof insertIngestionLogSchema>;
export type IngestionLog = typeof ingestionLogsTable.$inferSelect;
