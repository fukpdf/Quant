import { eq, and, desc } from "drizzle-orm";
import { db, ingestionJobsTable } from "@workspace/db";
import type { IngestionJob, InsertIngestionJob } from "@workspace/db";

// ---------------------------------------------------------------------------
// Ingestion Jobs
// ---------------------------------------------------------------------------

export async function createIngestionJob(
  data: Omit<InsertIngestionJob, "startedAt"> & { startedAt?: Date },
): Promise<string> {
  const [row] = await db
    .insert(ingestionJobsTable)
    .values({
      ...data,
      startedAt: data.startedAt ?? new Date(),
    })
    .returning({ id: ingestionJobsTable.id });

  return row!.id;
}

export async function completeIngestionJob(
  id: string,
  update: {
    status: string;
    recordsProcessed?: number;
    recordsInserted?: number;
    errorDetails?: string;
  },
): Promise<void> {
  const endedAt = new Date();
  const startRow = await db
    .select({ startedAt: ingestionJobsTable.startedAt })
    .from(ingestionJobsTable)
    .where(eq(ingestionJobsTable.id, id))
    .limit(1);

  const durationMs = startRow[0]
    ? endedAt.getTime() - new Date(startRow[0].startedAt).getTime()
    : null;

  await db
    .update(ingestionJobsTable)
    .set({
      status: update.status,
      endedAt,
      durationMs,
      recordsProcessed: update.recordsProcessed ?? 0,
      recordsInserted: update.recordsInserted ?? 0,
      errorDetails: update.errorDetails ?? null,
    })
    .where(eq(ingestionJobsTable.id, id));
}

export type IngestionJobFilters = {
  providerName?: string;
  symbol?: string;
  status?: string;
  jobType?: string;
  limit?: number;
};

export async function listIngestionJobs(
  filters?: IngestionJobFilters,
): Promise<IngestionJob[]> {
  const conditions = [];

  if (filters?.providerName) {
    conditions.push(eq(ingestionJobsTable.providerName, filters.providerName));
  }
  if (filters?.symbol) {
    conditions.push(eq(ingestionJobsTable.symbol, filters.symbol.toUpperCase()));
  }
  if (filters?.status) {
    conditions.push(eq(ingestionJobsTable.status, filters.status));
  }
  if (filters?.jobType) {
    conditions.push(eq(ingestionJobsTable.jobType, filters.jobType));
  }

  const limit = Math.min(filters?.limit ?? 20, 100);

  if (conditions.length > 0) {
    return db
      .select()
      .from(ingestionJobsTable)
      .where(and(...conditions))
      .orderBy(desc(ingestionJobsTable.startedAt))
      .limit(limit);
  }

  return db
    .select()
    .from(ingestionJobsTable)
    .orderBy(desc(ingestionJobsTable.startedAt))
    .limit(limit);
}
