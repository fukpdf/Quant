import {
  pgTable,
  uuid,
  varchar,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * News items from financial news sources.
 * Schema designed for future integration with providers (Reuters, Bloomberg,
 * CoinDesk, etc.) and AI sentiment analysis (Phase 9).
 *
 * sentimentScore: nullable float in range [-1.0, 1.0].
 *   Negative = bearish, Positive = bullish, null = not yet analysed.
 *   Populated by Phase 9 AI Research Assistant.
 */
export const newsItemsTable = pgTable(
  "news_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: varchar("source", { length: 100 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    category: varchar("category", { length: 50 }),
    url: text("url"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    /** Populated by Phase 9 AI sentiment analysis. Range [-1.0, 1.0] */
    sentimentScore: numeric("sentiment_score", { precision: 4, scale: 3 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("news_items_published_at_idx").on(table.publishedAt),
    index("news_items_source_idx").on(table.source),
    index("news_items_category_idx").on(table.category),
  ],
);

export const insertNewsItemSchema = createInsertSchema(newsItemsTable).omit({
  id: true,
  createdAt: true,
});

export const selectNewsItemSchema = createSelectSchema(newsItemsTable);

export type InsertNewsItem = z.infer<typeof insertNewsItemSchema>;
export type NewsItem = typeof newsItemsTable.$inferSelect;
