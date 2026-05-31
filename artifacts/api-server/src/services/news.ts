import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, newsItemsTable } from "@workspace/db";
import type { NewsItem, InsertNewsItem } from "@workspace/db";

export type NewsFilters = {
  source?: string;
  category?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listNewsItems(filters?: NewsFilters): Promise<NewsItem[]> {
  const conditions = [];

  if (filters?.source) {
    conditions.push(eq(newsItemsTable.source, filters.source));
  }
  if (filters?.category) {
    conditions.push(eq(newsItemsTable.category, filters.category));
  }
  if (filters?.from) {
    conditions.push(gte(newsItemsTable.publishedAt, filters.from));
  }
  if (filters?.to) {
    conditions.push(lte(newsItemsTable.publishedAt, filters.to));
  }

  const limit = Math.min(filters?.limit ?? 50, 200);

  if (conditions.length > 0) {
    return db
      .select()
      .from(newsItemsTable)
      .where(and(...conditions))
      .orderBy(desc(newsItemsTable.publishedAt))
      .limit(limit);
  }

  return db
    .select()
    .from(newsItemsTable)
    .orderBy(desc(newsItemsTable.publishedAt))
    .limit(limit);
}

export async function insertNewsItem(data: InsertNewsItem): Promise<string> {
  const [row] = await db
    .insert(newsItemsTable)
    .values(data)
    .returning({ id: newsItemsTable.id });
  return row!.id;
}
