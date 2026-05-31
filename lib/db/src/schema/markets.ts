import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const marketsTable = pgTable("markets", {
  id: uuid("id").defaultRandom().primaryKey(),
  symbol: varchar("symbol", { length: 30 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  exchange: varchar("exchange", { length: 50 }).notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMarketSchema = createInsertSchema(marketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectMarketSchema = createSelectSchema(marketsTable);

export type InsertMarket = z.infer<typeof insertMarketSchema>;
export type Market = typeof marketsTable.$inferSelect;
