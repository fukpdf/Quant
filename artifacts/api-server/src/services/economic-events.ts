import { eq, and, gte, lte, desc } from "drizzle-orm";
import { db, economicEventsTable } from "@workspace/db";
import type { EconomicEvent, InsertEconomicEvent } from "@workspace/db";

export type EconomicEventFilters = {
  country?: string;
  impact?: string;
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function listEconomicEvents(
  filters?: EconomicEventFilters,
): Promise<EconomicEvent[]> {
  const conditions = [];

  if (filters?.country) {
    conditions.push(
      eq(economicEventsTable.country, filters.country.toUpperCase()),
    );
  }
  if (filters?.impact) {
    conditions.push(eq(economicEventsTable.impact, filters.impact));
  }
  if (filters?.from) {
    conditions.push(gte(economicEventsTable.scheduledAt, filters.from));
  }
  if (filters?.to) {
    conditions.push(lte(economicEventsTable.scheduledAt, filters.to));
  }

  const limit = Math.min(filters?.limit ?? 50, 200);

  if (conditions.length > 0) {
    return db
      .select()
      .from(economicEventsTable)
      .where(and(...conditions))
      .orderBy(desc(economicEventsTable.scheduledAt))
      .limit(limit);
  }

  return db
    .select()
    .from(economicEventsTable)
    .orderBy(desc(economicEventsTable.scheduledAt))
    .limit(limit);
}

export async function insertEconomicEvent(
  data: InsertEconomicEvent,
): Promise<string> {
  const [row] = await db
    .insert(economicEventsTable)
    .values(data)
    .returning({ id: economicEventsTable.id });
  return row!.id;
}
