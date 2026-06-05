/**
 * attribution-engine.ts
 *
 * Return Attribution Engine.
 * Decomposes portfolio P&L into contributions by:
 * - Strategy (capital allocation, PnL, return, risk, Sharpe, drawdown contributions)
 * - Asset/Symbol (capital allocation, PnL, return, risk contributions)
 *
 * Data source: paper_trade_history, paper_positions, paper_strategy_assignments
 */

import { db } from "@workspace/db";
import {
  paperTradeHistoryTable,
  paperPositionsTable,
  paperAccountsTable,
  paperStrategyAssignmentsTable,
} from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  savePortfolioAttribution,
  saveStrategyAttributions,
  saveAssetAttributions,
  appendAnalyticsAuditLog,
} from "./analytics-db";
import { logger } from "../lib/logger";
import type { PortfolioAttribution, StrategyAttribution, AssetAttribution } from "@workspace/db";

function n(v: string | null | undefined): number {
  if (v == null) return 0;
  const x = parseFloat(v);
  return isNaN(x) ? 0 : x;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export interface AttributionResult {
  attribution: PortfolioAttribution;
  strategyAttributions: StrategyAttribution[];
  assetAttributions: AssetAttribution[];
}

export async function computeAndSaveAttribution(
  accountId: string,
  periodStart?: Date,
  periodEnd?: Date,
): Promise<AttributionResult> {
  const start = Date.now();
  const now = new Date();
  const pEnd = periodEnd ?? now;

  // Default period: inception
  const accountRows = await db
    .select()
    .from(paperAccountsTable)
    .where(eq(paperAccountsTable.id, accountId))
    .limit(1);
  if (!accountRows[0]) throw new Error(`Account not found: ${accountId}`);
  const account = accountRows[0];
  const pStart = periodStart ?? account.createdAt;

  logger.info({ accountId, pStart, pEnd }, "Computing attribution");

  // Load closed trades in the period
  const conditions = [
    eq(paperTradeHistoryTable.accountId, accountId),
    gte(paperTradeHistoryTable.exitedAt, pStart),
    lte(paperTradeHistoryTable.exitedAt, pEnd),
  ];
  const trades = await db
    .select()
    .from(paperTradeHistoryTable)
    .where(and(...conditions));

  // Compute top-level totals
  const totalPnl = trades.reduce((sum, t) => sum + n(t.netPnl), 0);
  const totalCommission = trades.reduce((sum, t) => sum + n(t.commission), 0);
  const totalSlippage = trades.reduce((sum, t) => sum + n(t.slippage), 0);
  const longPnl = trades.filter(t => t.side === "long").reduce((sum, t) => sum + n(t.netPnl), 0);
  const shortPnl = trades.filter(t => t.side === "short").reduce((sum, t) => sum + n(t.netPnl), 0);
  const startEquity = n(account.initialCapital);
  const totalReturnPct = startEquity > 0 ? (totalPnl / startEquity) * 100 : 0;

  // Group by strategy
  const strategyMap = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = t.strategyName ?? "unknown";
    if (!strategyMap.has(key)) strategyMap.set(key, []);
    strategyMap.get(key)!.push(t);
  }

  // Group by symbol
  const symbolMap = new Map<string, typeof trades>();
  for (const t of trades) {
    const key = t.symbol;
    if (!symbolMap.has(key)) symbolMap.set(key, []);
    symbolMap.get(key)!.push(t);
  }

  // Save top-level attribution record
  const strategyNames = [...strategyMap.keys()];
  let topStrategy = strategyNames[0] ?? null;
  let worstStrategy = strategyNames[0] ?? null;
  let topStratPnl = -Infinity, worstStratPnl = Infinity;
  for (const [sName, sTrades] of strategyMap.entries()) {
    const sPnl = sTrades.reduce((sum, t) => sum + n(t.netPnl), 0);
    if (sPnl > topStratPnl) { topStratPnl = sPnl; topStrategy = sName; }
    if (sPnl < worstStratPnl) { worstStratPnl = sPnl; worstStrategy = sName; }
  }

  const symbolNames = [...symbolMap.keys()];
  let topSymbol = symbolNames[0] ?? null;
  let worstSymbol = symbolNames[0] ?? null;
  let topSymPnl = -Infinity, worstSymPnl = Infinity;
  for (const [sym, symTrades] of symbolMap.entries()) {
    const sPnl = symTrades.reduce((sum, t) => sum + n(t.netPnl), 0);
    if (sPnl > topSymPnl) { topSymPnl = sPnl; topSymbol = sym; }
    if (sPnl < worstSymPnl) { worstSymPnl = sPnl; worstSymbol = sym; }
  }

  const attribution = await savePortfolioAttribution({
    accountId,
    periodStart: pStart,
    periodEnd: pEnd,
    totalPnl: String(totalPnl),
    totalReturnPct: String(totalReturnPct),
    longPnl: String(longPnl),
    shortPnl: String(shortPnl),
    totalCommission: String(totalCommission),
    totalSlippage: String(totalSlippage),
    strategyCount: strategyMap.size,
    assetCount: symbolMap.size,
    tradeCount: trades.length,
    topStrategyName: topStrategy,
    worstStrategyName: worstStrategy,
    topAssetSymbol: topSymbol,
    worstAssetSymbol: worstSymbol,
    computedAt: now,
  });

  // ---------------------------------------------------------------------------
  // Strategy attribution
  // ---------------------------------------------------------------------------
  const strategyRows: Parameters<typeof saveStrategyAttributions>[0] = [];
  const strategyArray = [...strategyMap.entries()].sort((a, b) => {
    const aPnl = a[1].reduce((s, t) => s + n(t.netPnl), 0);
    const bPnl = b[1].reduce((s, t) => s + n(t.netPnl), 0);
    return bPnl - aPnl; // descending
  });

  for (let rank = 0; rank < strategyArray.length; rank++) {
    const [stratName, sTrades] = strategyArray[rank]!;
    const sPnl = sTrades.reduce((sum, t) => sum + n(t.netPnl), 0);
    const sWins = sTrades.filter(t => n(t.netPnl) > 0);
    const sLosses = sTrades.filter(t => n(t.netPnl) <= 0);

    // Estimate capital allocated from trade values
    const capitalAllocated = sTrades.reduce((sum, t) => {
      return sum + n(t.entryPrice) * n(t.quantity);
    }, 0) / Math.max(sTrades.length, 1);

    const capitalAllocationPct = startEquity > 0 ? (capitalAllocated / startEquity) * 100 : 0;
    const returnContributionPct = startEquity > 0 ? (sPnl / startEquity) * 100 : 0;
    const strategyReturnPct = capitalAllocated > 0 ? (sPnl / capitalAllocated) * 100 : 0;

    // Drawdown on strategy trades
    let equity = 0;
    let peak = 0;
    let maxDD = 0;
    for (const t of sTrades) {
      equity += n(t.netPnl);
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }

    // Sharpe contribution (simple trade return series)
    const tradeReturns = sTrades.map(t => capitalAllocated > 0 ? n(t.netPnl) / capitalAllocated : 0);
    const vol = stdDev(tradeReturns);
    const meanReturn = tradeReturns.reduce((a, b) => a + b, 0) / (tradeReturns.length || 1);
    const sharpeContrib = vol > 0 ? meanReturn / vol : 0;

    strategyRows.push({
      attributionId: attribution.id,
      accountId,
      strategyName: stratName,
      periodStart: pStart,
      periodEnd: pEnd,
      capitalAllocated: String(capitalAllocated),
      capitalAllocationPct: String(capitalAllocationPct),
      pnlContribution: String(sPnl),
      returnContributionPct: String(returnContributionPct),
      strategyReturnPct: String(strategyReturnPct),
      riskContributionPct: String(capitalAllocationPct), // simplified: capital allocation = risk contribution
      sharpeContribution: String(sharpeContrib),
      maxDrawdownPct: String(maxDD * 100),
      winRatePct: String(sTrades.length > 0 ? (sWins.length / sTrades.length) * 100 : 0),
      tradeCount: sTrades.length,
      winCount: sWins.length,
      lossCount: sLosses.length,
      rank: rank + 1,
    });
  }
  const strategyAttributions = await saveStrategyAttributions(strategyRows);

  // ---------------------------------------------------------------------------
  // Asset attribution
  // ---------------------------------------------------------------------------
  const assetRows: Parameters<typeof saveAssetAttributions>[0] = [];
  const assetArray = [...symbolMap.entries()].sort((a, b) => {
    const aPnl = a[1].reduce((s, t) => s + n(t.netPnl), 0);
    const bPnl = b[1].reduce((s, t) => s + n(t.netPnl), 0);
    return bPnl - aPnl;
  });

  for (let rank = 0; rank < assetArray.length; rank++) {
    const [symbol, aTrades] = assetArray[rank]!;
    const aPnl = aTrades.reduce((sum, t) => sum + n(t.netPnl), 0);
    const aWins = aTrades.filter(t => n(t.netPnl) > 0);
    const aLosses = aTrades.filter(t => n(t.netPnl) <= 0);

    const capitalAllocated = aTrades.reduce((sum, t) => {
      return sum + n(t.entryPrice) * n(t.quantity);
    }, 0) / Math.max(aTrades.length, 1);

    const capitalAllocationPct = startEquity > 0 ? (capitalAllocated / startEquity) * 100 : 0;
    const returnContributionPct = startEquity > 0 ? (aPnl / startEquity) * 100 : 0;
    const assetReturnPct = capitalAllocated > 0 ? (aPnl / capitalAllocated) * 100 : 0;

    let equity = 0, peak = 0, maxDD = 0;
    for (const t of aTrades) {
      equity += n(t.netPnl);
      if (equity > peak) peak = equity;
      const dd = peak > 0 ? (peak - equity) / peak : 0;
      if (dd > maxDD) maxDD = dd;
    }

    assetRows.push({
      attributionId: attribution.id,
      accountId,
      symbol,
      periodStart: pStart,
      periodEnd: pEnd,
      capitalAllocated: String(capitalAllocated),
      capitalAllocationPct: String(capitalAllocationPct),
      pnlContribution: String(aPnl),
      returnContributionPct: String(returnContributionPct),
      assetReturnPct: String(assetReturnPct),
      riskContributionPct: String(capitalAllocationPct),
      maxDrawdownPct: String(maxDD * 100),
      winRatePct: String(aTrades.length > 0 ? (aWins.length / aTrades.length) * 100 : 0),
      tradeCount: aTrades.length,
      winCount: aWins.length,
      lossCount: aLosses.length,
      rank: rank + 1,
    });
  }
  const assetAttributions = await saveAssetAttributions(assetRows);

  await appendAnalyticsAuditLog({
    actor: "system",
    action: "attribution.compute",
    accountId,
    entityType: "attribution",
    entityId: attribution.id,
    result: "success",
    durationMs: String(Date.now() - start),
    payload: {
      trades: trades.length,
      strategies: strategyMap.size,
      assets: symbolMap.size,
    },
  });

  return { attribution, strategyAttributions, assetAttributions };
}
