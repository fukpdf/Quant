/**
 * allocation-tracker.ts
 *
 * Tracks portfolio allocation across strategies and assets.
 * Computes current allocation, allocation drift, and target allocation metrics.
 * Saves periodic allocation snapshots.
 */

import { db } from "@workspace/db";
import {
  paperPositionsTable,
  paperAccountsTable,
  paperStrategyAssignmentsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  saveAllocationSnapshot,
  listAllocationSnapshots,
  getLatestAllocationSnapshot,
  appendAnalyticsAuditLog,
} from "./analytics-db";
import { logger } from "../lib/logger";
import type { AllocationSnapshot } from "@workspace/db";

function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

export interface AllocationAnalysis {
  accountId: string;
  computedAt: Date;
  totalEquity: number;
  cashAllocationPct: number;
  investedAllocationPct: number;
  activePositionCount: number;
  activeStrategyCount: number;
  strategyBreakdown: Array<{
    strategy: string;
    pct: number;
    value: number;
    positionCount: number;
  }>;
  assetBreakdown: Array<{
    symbol: string;
    pct: number;
    value: number;
    positionCount: number;
  }>;
  hhi: number;
  effectiveN: number;
  largestPositionPct: number;
  largestPositionSymbol: string;
  driftFromPrevious: Array<{
    symbol: string;
    currentPct: number;
    previousPct: number;
    drift: number;
  }> | null;
  snapshot: AllocationSnapshot;
}

export async function computeAndSaveAllocation(accountId: string): Promise<AllocationAnalysis> {
  const startMs = Date.now();
  logger.info({ accountId }, "Computing allocation snapshot");

  const accountRows = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, accountId))
    .limit(1);
  if (!accountRows[0]) throw new Error(`Account not found: ${accountId}`);
  const account = accountRows[0];

  const equity = n(account.currentEquity);
  const cash = n(account.cashBalance);

  // Open positions
  const positions = await db
    .select()
    .from(paperPositionsTable)
    .where(and(
      eq(paperPositionsTable.accountId, accountId),
      eq(paperPositionsTable.status, "open"),
    ));

  // Active strategies
  const assignments = await db
    .select()
    .from(paperStrategyAssignmentsTable)
    .where(and(
      eq(paperStrategyAssignmentsTable.accountId, accountId),
      eq(paperStrategyAssignmentsTable.status, "active"),
    ));

  const totalInvested = positions.reduce((s, p) => s + n(p.marketValue), 0);
  const cashPct = equity > 0 ? (cash / equity) * 100 : 100;
  const investedPct = equity > 0 ? (totalInvested / equity) * 100 : 0;

  // Per-strategy breakdown
  const stratMap = new Map<string, { value: number; count: number }>();
  for (const p of positions) {
    const key = p.strategyName ?? "manual";
    const ex = stratMap.get(key) ?? { value: 0, count: 0 };
    stratMap.set(key, { value: ex.value + n(p.marketValue), count: ex.count + 1 });
  }
  const strategyBreakdown = [...stratMap.entries()]
    .map(([strategy, { value, count }]) => ({
      strategy,
      pct: equity > 0 ? (value / equity) * 100 : 0,
      value,
      positionCount: count,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Per-asset breakdown
  const assetMap = new Map<string, { value: number; count: number }>();
  for (const p of positions) {
    const key = p.symbol;
    const ex = assetMap.get(key) ?? { value: 0, count: 0 };
    assetMap.set(key, { value: ex.value + n(p.marketValue), count: ex.count + 1 });
  }
  const assetBreakdown = [...assetMap.entries()]
    .map(([symbol, { value, count }]) => ({
      symbol,
      pct: equity > 0 ? (value / equity) * 100 : 0,
      value,
      positionCount: count,
    }))
    .sort((a, b) => b.pct - a.pct);

  // HHI and effective N (based on asset allocation)
  const weights = assetBreakdown.map(a => a.pct / 100);
  const hhi = weights.reduce((s, w) => s + w * w, 0) * 10000;
  const effectiveN = hhi > 0 ? 10000 / hhi : 1;

  const largestPos = assetBreakdown[0] ?? { symbol: "none", pct: 0 };

  // Save snapshot
  const snapshot = await saveAllocationSnapshot({
    accountId,
    snapshotAt: new Date(),
    totalEquity: String(equity),
    cashAllocationPct: String(cashPct),
    investedAllocationPct: String(investedPct),
    activePositionCount: positions.length,
    activeStrategyCount: assignments.length,
    strategyBreakdown: strategyBreakdown.map(s => ({ strategy: s.strategy, pct: s.pct, value: s.value })),
    assetBreakdown: assetBreakdown.map(a => ({ symbol: a.symbol, pct: a.pct, value: a.value })),
    hhi: String(hhi),
    effectiveN: String(effectiveN),
    largestPositionPct: String(largestPos.pct),
    largestPositionSymbol: largestPos.symbol,
  });

  // Compute drift from previous snapshot
  let driftFromPrevious: AllocationAnalysis["driftFromPrevious"] = null;
  const prevSnaps = await listAllocationSnapshots(accountId, 2);
  const prevSnap = prevSnaps.find(s => s.id !== snapshot.id);
  if (prevSnap && Array.isArray(prevSnap.assetBreakdown)) {
    const prevBreakdown = prevSnap.assetBreakdown as Array<{ symbol: string; pct: number }>;
    driftFromPrevious = assetBreakdown.map(a => {
      const prev = prevBreakdown.find(p => p.symbol === a.symbol);
      return {
        symbol: a.symbol,
        currentPct: a.pct,
        previousPct: prev?.pct ?? 0,
        drift: a.pct - (prev?.pct ?? 0),
      };
    });
  }

  await appendAnalyticsAuditLog({
    actor: "system",
    action: "allocation.snapshot",
    accountId,
    entityType: "allocation",
    entityId: snapshot.id,
    result: "success",
    durationMs: String(Date.now() - startMs),
    payload: { positions: positions.length, strategies: assignments.length, hhi },
  });

  return {
    accountId,
    computedAt: new Date(),
    totalEquity: equity,
    cashAllocationPct: cashPct,
    investedAllocationPct: investedPct,
    activePositionCount: positions.length,
    activeStrategyCount: assignments.length,
    strategyBreakdown,
    assetBreakdown,
    hhi,
    effectiveN,
    largestPositionPct: largestPos.pct,
    largestPositionSymbol: largestPos.symbol,
    driftFromPrevious,
    snapshot,
  };
}

export { getLatestAllocationSnapshot, listAllocationSnapshots };
