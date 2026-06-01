import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  paperAccountsTable,
  paperPortfoliosTable,
  paperPositionsTable,
  paperOrdersTable,
  paperFillsTable,
  paperTradeHistoryTable,
  paperDailySnapshotsTable,
  paperStrategyAssignmentsTable,
  paperAlertsTable,
  type PaperAccount,
  type InsertPaperAccount,
  type PaperPortfolio,
  type InsertPaperPortfolio,
  type PaperPosition,
  type InsertPaperPosition,
  type PaperOrder,
  type InsertPaperOrder,
  type PaperFill,
  type InsertPaperFill,
  type InsertPaperExecution,
  type PaperTradeHistory,
  type InsertPaperTradeHistory,
  type PaperDailySnapshot,
  type InsertPaperDailySnapshot,
  type PaperStrategyAssignment,
  type InsertPaperStrategyAssignment,
  type PaperAlert,
  type InsertPaperAlert,
  paperExecutionsTable,
} from "@workspace/db";

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export async function createPaperAccount(data: {
  name: string;
  description?: string;
  initialCapital: number;
}): Promise<PaperAccount> {
  const capital = String(data.initialCapital);
  const [row] = await db
    .insert(paperAccountsTable)
    .values({
      name: data.name,
      description: data.description ?? null,
      initialCapital: capital,
      currentEquity: capital,
      cashBalance: capital,
      buyingPower: capital,
      realizedPnl: "0",
      unrealizedPnl: "0",
      marginUsed: "0",
      status: "active",
    })
    .returning();

  if (!row) throw new Error("Failed to create paper account");

  // Initialise companion portfolio row
  await db.insert(paperPortfoliosTable).values({
    accountId: row.id,
    openPositions: 0,
    closedPositions: 0,
    totalExposure: "0",
    allocationPct: "0",
    peakEquity: capital,
    currentDrawdownPct: "0",
    maxDrawdownPct: "0",
    dailyReturnPct: "0",
  });

  return row;
}

export async function listPaperAccounts(status?: string): Promise<PaperAccount[]> {
  if (status) {
    return db
      .select()
      .from(paperAccountsTable)
      .where(eq(paperAccountsTable.status, status))
      .orderBy(desc(paperAccountsTable.createdAt));
  }
  return db
    .select()
    .from(paperAccountsTable)
    .orderBy(desc(paperAccountsTable.createdAt));
}

export async function getPaperAccount(id: string): Promise<PaperAccount | null> {
  const [row] = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function updatePaperAccount(
  id: string,
  updates: Partial<{
    currentEquity: string;
    cashBalance: string;
    buyingPower: string;
    realizedPnl: string;
    unrealizedPnl: string;
    marginUsed: string;
    status: string;
  }>,
): Promise<void> {
  await db
    .update(paperAccountsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(paperAccountsTable.id, id));
}

// ---------------------------------------------------------------------------
// Portfolios
// ---------------------------------------------------------------------------

export async function getPaperPortfolio(accountId: string): Promise<PaperPortfolio | null> {
  const [row] = await db
    .select()
    .from(paperPortfoliosTable)
    .where(eq(paperPortfoliosTable.accountId, accountId))
    .limit(1);
  return row ?? null;
}

export async function upsertPaperPortfolio(
  accountId: string,
  data: Omit<InsertPaperPortfolio, "accountId">,
): Promise<void> {
  const existing = await getPaperPortfolio(accountId);
  if (existing) {
    await db
      .update(paperPortfoliosTable)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(paperPortfoliosTable.accountId, accountId));
  } else {
    await db
      .insert(paperPortfoliosTable)
      .values({ accountId, ...data });
  }
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export async function createPaperPosition(data: InsertPaperPosition): Promise<PaperPosition> {
  const [row] = await db.insert(paperPositionsTable).values(data).returning();
  if (!row) throw new Error("Failed to create paper position");
  return row;
}

export async function getOpenPositions(accountId: string): Promise<PaperPosition[]> {
  return db
    .select()
    .from(paperPositionsTable)
    .where(
      and(
        eq(paperPositionsTable.accountId, accountId),
        eq(paperPositionsTable.status, "open"),
      ),
    )
    .orderBy(desc(paperPositionsTable.openedAt));
}

export async function getAllPositions(
  accountId: string,
  opts?: { status?: string; limit?: number },
): Promise<PaperPosition[]> {
  const conditions = [eq(paperPositionsTable.accountId, accountId)];
  if (opts?.status) conditions.push(eq(paperPositionsTable.status, opts.status));

  return db
    .select()
    .from(paperPositionsTable)
    .where(and(...conditions))
    .orderBy(desc(paperPositionsTable.openedAt))
    .limit(opts?.limit ?? 200);
}

export async function updatePaperPosition(
  id: string,
  updates: Partial<{
    currentPrice: string;
    marketValue: string;
    unrealizedPnl: string;
    realizedPnl: string;
    exitPrice: string;
    status: string;
    closedAt: Date;
  }>,
): Promise<void> {
  await db
    .update(paperPositionsTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(paperPositionsTable.id, id));
}

export async function getOpenPositionBySymbolAndStrategy(
  accountId: string,
  symbol: string,
  strategyName: string,
): Promise<PaperPosition | null> {
  const [row] = await db
    .select()
    .from(paperPositionsTable)
    .where(
      and(
        eq(paperPositionsTable.accountId, accountId),
        eq(paperPositionsTable.symbol, symbol),
        eq(paperPositionsTable.strategyName, strategyName),
        eq(paperPositionsTable.status, "open"),
      ),
    )
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function createPaperOrder(data: InsertPaperOrder): Promise<PaperOrder> {
  const [row] = await db.insert(paperOrdersTable).values(data).returning();
  if (!row) throw new Error("Failed to create paper order");
  return row;
}

export async function getPaperOrder(id: string): Promise<PaperOrder | null> {
  const [row] = await db
    .select()
    .from(paperOrdersTable)
    .where(eq(paperOrdersTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function listPaperOrders(
  accountId: string,
  opts?: { status?: string; limit?: number },
): Promise<PaperOrder[]> {
  const conditions = [eq(paperOrdersTable.accountId, accountId)];
  if (opts?.status) conditions.push(eq(paperOrdersTable.status, opts.status));

  return db
    .select()
    .from(paperOrdersTable)
    .where(and(...conditions))
    .orderBy(desc(paperOrdersTable.createdAt))
    .limit(opts?.limit ?? 200);
}

export async function updatePaperOrder(
  id: string,
  updates: Partial<{
    status: string;
    filledQuantity: string;
    avgFillPrice: string;
    rejectReason: string;
    submittedAt: Date;
    filledAt: Date;
    cancelledAt: Date;
  }>,
): Promise<void> {
  await db
    .update(paperOrdersTable)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(paperOrdersTable.id, id));
}

// ---------------------------------------------------------------------------
// Fills
// ---------------------------------------------------------------------------

export async function createPaperFill(data: InsertPaperFill): Promise<PaperFill> {
  const [row] = await db.insert(paperFillsTable).values(data).returning();
  if (!row) throw new Error("Failed to create paper fill");
  return row;
}

export async function listPaperFills(
  accountId: string,
  opts?: { limit?: number },
): Promise<PaperFill[]> {
  return db
    .select()
    .from(paperFillsTable)
    .where(eq(paperFillsTable.accountId, accountId))
    .orderBy(desc(paperFillsTable.filledAt))
    .limit(opts?.limit ?? 200);
}

// ---------------------------------------------------------------------------
// Executions
// ---------------------------------------------------------------------------

export async function createPaperExecution(data: InsertPaperExecution): Promise<void> {
  await db.insert(paperExecutionsTable).values(data);
}

// ---------------------------------------------------------------------------
// Trade History
// ---------------------------------------------------------------------------

export async function recordPaperTrade(data: InsertPaperTradeHistory): Promise<PaperTradeHistory> {
  const [row] = await db.insert(paperTradeHistoryTable).values(data).returning();
  if (!row) throw new Error("Failed to record paper trade");
  return row;
}

export async function listPaperTrades(
  accountId: string,
  opts?: { limit?: number; startDate?: Date; endDate?: Date },
): Promise<PaperTradeHistory[]> {
  const conditions = [eq(paperTradeHistoryTable.accountId, accountId)];
  if (opts?.startDate) conditions.push(gte(paperTradeHistoryTable.exitedAt, opts.startDate));
  if (opts?.endDate) conditions.push(lte(paperTradeHistoryTable.exitedAt, opts.endDate));

  return db
    .select()
    .from(paperTradeHistoryTable)
    .where(and(...conditions))
    .orderBy(desc(paperTradeHistoryTable.exitedAt))
    .limit(opts?.limit ?? 500);
}

// ---------------------------------------------------------------------------
// Daily Snapshots
// ---------------------------------------------------------------------------

export async function upsertDailySnapshot(data: InsertPaperDailySnapshot): Promise<void> {
  await db
    .insert(paperDailySnapshotsTable)
    .values(data)
    .onConflictDoUpdate({
      target: [paperDailySnapshotsTable.accountId, paperDailySnapshotsTable.snapshotDate],
      set: {
        equity: data.equity,
        cashBalance: data.cashBalance,
        positionValue: data.positionValue,
        dailyRealizedPnl: data.dailyRealizedPnl,
        unrealizedPnl: data.unrealizedPnl,
        dailyReturnPct: data.dailyReturnPct,
        drawdownPct: data.drawdownPct,
        openPositions: data.openPositions,
        tradesClosed: data.tradesClosed,
      },
    });
}

export async function listDailySnapshots(
  accountId: string,
  opts?: { limit?: number },
): Promise<PaperDailySnapshot[]> {
  return db
    .select()
    .from(paperDailySnapshotsTable)
    .where(eq(paperDailySnapshotsTable.accountId, accountId))
    .orderBy(desc(paperDailySnapshotsTable.snapshotDate))
    .limit(opts?.limit ?? 365);
}

// ---------------------------------------------------------------------------
// Strategy Assignments
// ---------------------------------------------------------------------------

export async function createStrategyAssignment(
  data: InsertPaperStrategyAssignment,
): Promise<PaperStrategyAssignment> {
  const [row] = await db
    .insert(paperStrategyAssignmentsTable)
    .values(data)
    .returning();
  if (!row) throw new Error("Failed to create strategy assignment");
  return row;
}

export async function getActiveAssignments(accountId?: string): Promise<PaperStrategyAssignment[]> {
  const conditions = [eq(paperStrategyAssignmentsTable.status, "active")];
  if (accountId) conditions.push(eq(paperStrategyAssignmentsTable.accountId, accountId));

  return db
    .select()
    .from(paperStrategyAssignmentsTable)
    .where(and(...conditions))
    .orderBy(desc(paperStrategyAssignmentsTable.assignedAt));
}

export async function getAllAssignments(accountId?: string): Promise<PaperStrategyAssignment[]> {
  const conditions = accountId
    ? [eq(paperStrategyAssignmentsTable.accountId, accountId)]
    : [];

  return db
    .select()
    .from(paperStrategyAssignmentsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(paperStrategyAssignmentsTable.assignedAt));
}

export async function updateAssignmentStatus(
  id: string,
  status: "active" | "paused" | "disabled",
  reason?: string,
): Promise<void> {
  const now = new Date();
  const updates: Record<string, unknown> = {
    status,
    statusReason: reason ?? null,
    updatedAt: now,
  };
  if (status === "paused") updates["pausedAt"] = now;
  if (status === "active") updates["resumedAt"] = now;
  if (status === "disabled") updates["disabledAt"] = now;

  await db
    .update(paperStrategyAssignmentsTable)
    .set(updates)
    .where(eq(paperStrategyAssignmentsTable.id, id));
}

export async function getAssignment(id: string): Promise<PaperStrategyAssignment | null> {
  const [row] = await db
    .select()
    .from(paperStrategyAssignmentsTable)
    .where(eq(paperStrategyAssignmentsTable.id, id))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function createPaperAlert(data: InsertPaperAlert): Promise<PaperAlert> {
  const [row] = await db.insert(paperAlertsTable).values(data).returning();
  if (!row) throw new Error("Failed to create paper alert");
  return row;
}

export async function listPaperAlerts(
  accountId?: string,
  opts?: { acknowledged?: boolean; severity?: string; limit?: number },
): Promise<PaperAlert[]> {
  const conditions = [];
  if (accountId) conditions.push(eq(paperAlertsTable.accountId, accountId));
  if (opts?.acknowledged !== undefined)
    conditions.push(eq(paperAlertsTable.acknowledged, opts.acknowledged));
  if (opts?.severity) conditions.push(eq(paperAlertsTable.severity, opts.severity));

  return db
    .select()
    .from(paperAlertsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(paperAlertsTable.createdAt))
    .limit(opts?.limit ?? 200);
}

// ---------------------------------------------------------------------------
// Aggregate helpers
// ---------------------------------------------------------------------------

/** Count trades closed today for snapshot purposes */
export async function countTodayTrades(accountId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [result] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(paperTradeHistoryTable)
    .where(
      and(
        eq(paperTradeHistoryTable.accountId, accountId),
        gte(paperTradeHistoryTable.exitedAt, today),
      ),
    );

  return result?.count ?? 0;
}
