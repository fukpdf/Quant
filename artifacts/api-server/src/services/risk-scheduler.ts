import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { paperAccountsTable, paperPortfoliosTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeAndStoreCorrelationMatrix } from "./correlation-engine";
import { scoreAllStrategies } from "./strategy-risk-scorer";
import { monitorAccountDrawdown } from "./drawdown-monitor";
import { resolveActiveProfile } from "./risk-profile-service";
import {
  createPortfolioRiskSnapshot,
  appendAuditLog,
} from "./risk-db";
import { isSchedulerPaused } from "./kill-switch-service";

/**
 * Risk Scheduler — Phase 6.
 *
 * Runs periodic risk monitoring jobs independently of the paper trading scheduler.
 * All intervals configurable via environment variables.
 *
 * Jobs:
 *  - Risk Snapshots: every 10 minutes (RISK_SNAPSHOT_INTERVAL_MS)
 *  - Correlation Matrix: every 6 hours (RISK_CORRELATION_INTERVAL_MS)
 *  - Strategy Risk Scoring: every 1 hour (RISK_SCORING_INTERVAL_MS)
 *  - Exposure Analysis + Drawdown Monitor: every 5 minutes (RISK_EXPOSURE_INTERVAL_MS)
 *  - Circuit Breaker Monitoring: every 2 minutes (RISK_BREAKER_INTERVAL_MS)
 */

const RISK_SNAPSHOT_INTERVAL_MS = Number(process.env["RISK_SNAPSHOT_INTERVAL_MS"] ?? 600_000);      // 10 min
const RISK_CORRELATION_INTERVAL_MS = Number(process.env["RISK_CORRELATION_INTERVAL_MS"] ?? 21_600_000); // 6 h
const RISK_SCORING_INTERVAL_MS = Number(process.env["RISK_SCORING_INTERVAL_MS"] ?? 3_600_000);      // 1 h
const RISK_EXPOSURE_INTERVAL_MS = Number(process.env["RISK_EXPOSURE_INTERVAL_MS"] ?? 300_000);       // 5 min
const RISK_BREAKER_INTERVAL_MS = Number(process.env["RISK_BREAKER_INTERVAL_MS"] ?? 120_000);         // 2 min

const timers: NodeJS.Timeout[] = [];

// ---------------------------------------------------------------------------
// Individual job runners
// ---------------------------------------------------------------------------

async function runRiskSnapshots(): Promise<void> {
  if (isSchedulerPaused()) return;

  try {
    const accounts = await db
      .select()
      .from(paperAccountsTable)
      .where(eq(paperAccountsTable.status, "active"));

    for (const account of accounts) {
      const portfolio = await db
        .select()
        .from(paperPortfoliosTable)
        .where(eq(paperPortfoliosTable.accountId, account.id))
        .limit(1);

      const p = portfolio[0];
      const equity = parseFloat(account.currentEquity);
      const totalExposure = p ? parseFloat(p.totalExposure) : 0;
      const openPositions = p ? p.openPositions : 0;

      // Simple HHI-proxy concentration score:
      // Without per-position data in this context, approximate from portfolio-level data
      const exposurePct = equity > 0 ? (totalExposure / equity) * 100 : 0;
      const largestPositionPct =
        openPositions > 0 ? parseFloat(p?.totalExposure ?? "0") / openPositions / equity * 100 : 0;
      const concentrationScore = openPositions > 0
        ? Math.min(100, (1 / openPositions) * 100 * (exposurePct / 100))
        : 0;
      const diversificationScore = openPositions > 1
        ? Math.min(100, (1 - concentrationScore / 100) * 100)
        : openPositions === 1 ? 50 : 100;

      const portfolioHealthScore = Math.max(0, 100 - exposurePct * 0.3 - concentrationScore * 0.5);

      const dailyDrawdownPct = p ? Math.abs(parseFloat(p.dailyReturnPct)) : 0;
      const totalDrawdownPct = p ? parseFloat(p.currentDrawdownPct) : 0;

      await createPortfolioRiskSnapshot({
        accountId: account.id,
        totalExposure: String(totalExposure.toFixed(8)),
        portfolioExposurePct: String(exposurePct.toFixed(4)),
        largestPositionPct: String(largestPositionPct.toFixed(4)),
        concentrationScore: String(concentrationScore.toFixed(2)),
        diversificationScore: String(diversificationScore.toFixed(2)),
        portfolioHealthScore: String(portfolioHealthScore.toFixed(2)),
        dailyDrawdownPct: String(dailyDrawdownPct.toFixed(4)),
        weeklyDrawdownPct: String((p ? parseFloat(p.currentDrawdownPct) * 0.5 : 0).toFixed(4)),
        totalDrawdownPct: String(totalDrawdownPct.toFixed(4)),
        openPositions,
        snapshotAt: new Date(),
      });
    }

    logger.debug({ accounts: accounts.length }, "Risk snapshots captured");
  } catch (err) {
    logger.error({ err }, "Risk snapshot job failed");
  }
}

async function runCorrelationMatrix(): Promise<void> {
  if (isSchedulerPaused()) return;

  try {
    await computeAndStoreCorrelationMatrix(30);
    logger.info("Correlation matrix computed");
  } catch (err) {
    logger.error({ err }, "Correlation matrix job failed");
  }
}

async function runStrategyRiskScoring(): Promise<void> {
  if (isSchedulerPaused()) return;

  try {
    await scoreAllStrategies();
    logger.info("Strategy risk scoring complete");
  } catch (err) {
    logger.error({ err }, "Strategy risk scoring job failed");
  }
}

async function runExposureAndDrawdownMonitor(): Promise<void> {
  if (isSchedulerPaused()) return;

  try {
    const accounts = await db
      .select()
      .from(paperAccountsTable)
      .where(eq(paperAccountsTable.status, "active"));

    for (const account of accounts) {
      const profile = await resolveActiveProfile(account.id);
      if (!profile) continue;

      const maxDrawdownPct = parseFloat(profile.maxDrawdownPct);
      const maxDailyLossPct = parseFloat(profile.maxDailyLossPct);
      const maxWeeklyLossPct = parseFloat(profile.maxWeeklyLossPct);

      await monitorAccountDrawdown(
        account.id,
        maxDrawdownPct,
        maxDailyLossPct,
        maxWeeklyLossPct,
      );
    }
  } catch (err) {
    logger.error({ err }, "Exposure/drawdown monitor job failed");
  }
}

async function runCircuitBreakerMonitor(): Promise<void> {
  if (isSchedulerPaused()) return;

  // Circuit breaker state is managed in-memory; this job is a stub
  // for future enhancement: auto-recovery after a cooldown period.
  // Phase 6: monitor only. Phase 8: add auto-recovery logic.
  logger.debug("Circuit breaker monitor: no auto-recovery in Phase 6 (manual reset required)");
}

// ---------------------------------------------------------------------------
// Public lifecycle
// ---------------------------------------------------------------------------

export function startRiskScheduler(): void {
  logger.info(
    {
      snapshotIntervalMs: RISK_SNAPSHOT_INTERVAL_MS,
      correlationIntervalMs: RISK_CORRELATION_INTERVAL_MS,
      scoringIntervalMs: RISK_SCORING_INTERVAL_MS,
      exposureIntervalMs: RISK_EXPOSURE_INTERVAL_MS,
      breakerIntervalMs: RISK_BREAKER_INTERVAL_MS,
    },
    "Starting Phase 6 risk scheduler",
  );

  timers.push(setInterval(() => void runRiskSnapshots(), RISK_SNAPSHOT_INTERVAL_MS));
  timers.push(setInterval(() => void runCorrelationMatrix(), RISK_CORRELATION_INTERVAL_MS));
  timers.push(setInterval(() => void runStrategyRiskScoring(), RISK_SCORING_INTERVAL_MS));
  timers.push(setInterval(() => void runExposureAndDrawdownMonitor(), RISK_EXPOSURE_INTERVAL_MS));
  timers.push(setInterval(() => void runCircuitBreakerMonitor(), RISK_BREAKER_INTERVAL_MS));

  // Run initial jobs immediately (non-blocking)
  setTimeout(() => void runRiskSnapshots(), 5_000);
  setTimeout(() => void runStrategyRiskScoring(), 10_000);
}

export function stopRiskScheduler(): void {
  for (const t of timers) clearInterval(t);
  timers.length = 0;
  logger.info("Risk scheduler stopped");
}
