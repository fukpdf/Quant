/**
 * Equity curve persistence service — Phase 4.
 * Stores and retrieves compact equity curve time-series for backtests.
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  equityCurvesTable,
  type InsertEquityCurve,
  type EquityCurve,
} from "@workspace/db";
import type { EquityCurvePoint } from "../strategies/types";
import { logger } from "../lib/logger";

/** Compact serialised point: { t: ms, e: equity, d: drawdownPct } */
interface CompactPoint {
  t: number;
  e: number;
  d: number;
}

function buildCompactCurve(
  equityCurve: EquityCurvePoint[],
): { points: CompactPoint[]; peak: number; maxDrawdown: number } {
  let peak = -Infinity;
  let maxDrawdown = 0;
  const points: CompactPoint[] = [];

  for (const pt of equityCurve) {
    if (pt.equity > peak) peak = pt.equity;
    const drawdownPct = peak > 0 ? (peak - pt.equity) / peak : 0;
    if (drawdownPct > maxDrawdown) maxDrawdown = drawdownPct;
    points.push({ t: pt.timestamp.getTime(), e: pt.equity, d: drawdownPct });
  }

  return { points, peak: peak === -Infinity ? 0 : peak, maxDrawdown };
}

export interface EquityCurveTarget {
  backtestRunId?: string;
  portfolioBacktestId?: string;
}

export async function saveEquityCurve(
  target: EquityCurveTarget,
  equityCurve: EquityCurvePoint[],
  initialCapital: number,
): Promise<void> {
  if (equityCurve.length === 0) return;

  const { points, peak, maxDrawdown } = buildCompactCurve(equityCurve);
  const endEquity = equityCurve[equityCurve.length - 1]!.equity;

  const row: InsertEquityCurve = {
    backtestRunId: target.backtestRunId ?? null,
    portfolioBacktestId: target.portfolioBacktestId ?? null,
    curveData: JSON.stringify(points),
    totalPoints: points.length,
    startEquity: String(initialCapital),
    endEquity: String(endEquity),
    peakEquity: String(peak),
    maxDrawdownPct: String(maxDrawdown),
    generatedAt: new Date(),
  };

  await db.insert(equityCurvesTable).values(row);
  logger.debug(
    { target, points: points.length, maxDrawdown },
    "Equity curve saved",
  );
}

export async function getEquityCurveForRun(
  backtestRunId: string,
): Promise<EquityCurve | null> {
  const [row] = await db
    .select()
    .from(equityCurvesTable)
    .where(eq(equityCurvesTable.backtestRunId, backtestRunId))
    .orderBy(equityCurvesTable.generatedAt)
    .limit(1);
  return row ?? null;
}

export async function getEquityCurveForPortfolio(
  portfolioBacktestId: string,
): Promise<EquityCurve | null> {
  const [row] = await db
    .select()
    .from(equityCurvesTable)
    .where(eq(equityCurvesTable.portfolioBacktestId, portfolioBacktestId))
    .orderBy(equityCurvesTable.generatedAt)
    .limit(1);
  return row ?? null;
}

/** Parse stored JSON back to EquityCurvePoint array */
export function parseEquityCurveData(
  curveData: string,
): EquityCurvePoint[] {
  const points = JSON.parse(curveData) as CompactPoint[];
  return points.map((p) => ({
    timestamp: new Date(p.t),
    equity: p.e,
  }));
}
