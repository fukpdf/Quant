import { logger } from "../lib/logger";
import { listPaperAccounts, getActiveAssignments, getOpenPositions } from "./paper-accounts-db";
import { processAssignment, getLivePrice } from "./paper-signal-engine";
import { markToMarket } from "./paper-position-manager";
import { refreshPortfolio } from "./paper-portfolio-tracker";
import { runAlertChecks } from "./paper-alert-manager";
import { snapshotAllAccounts } from "./paper-snapshot-service";

/**
 * Paper Trading Scheduler — Phase 5.
 *
 * Runs a continuous background loop that:
 *   1. Every SIGNAL_INTERVAL_MS — processes all active strategy assignments
 *   2. Every MTM_INTERVAL_MS   — marks all open positions to market
 *   3. Every SNAPSHOT_INTERVAL_MS — takes daily snapshots for all accounts
 *   4. Every ALERT_INTERVAL_MS — runs alert checks for all active accounts
 *
 * Architecture supports continuous operation. Intervals are configurable
 * via environment variables for flexibility across environments.
 *
 * No real broker. No real capital. Simulation only.
 */

/** How often to check strategies for new signals (default: 5 minutes) */
const SIGNAL_INTERVAL_MS = parseInt(process.env["PAPER_SIGNAL_INTERVAL_MS"] ?? "300000");

/** How often to mark positions to market (default: 2 minutes) */
const MTM_INTERVAL_MS = parseInt(process.env["PAPER_MTM_INTERVAL_MS"] ?? "120000");

/** How often to take daily snapshots (default: every 6 hours) */
const SNAPSHOT_INTERVAL_MS = parseInt(process.env["PAPER_SNAPSHOT_INTERVAL_MS"] ?? "21600000");

/** How often to run alert checks (default: 10 minutes) */
const ALERT_INTERVAL_MS = parseInt(process.env["PAPER_ALERT_INTERVAL_MS"] ?? "600000");

let signalTimer: ReturnType<typeof setInterval> | null = null;
let mtmTimer: ReturnType<typeof setInterval> | null = null;
let snapshotTimer: ReturnType<typeof setInterval> | null = null;
let alertTimer: ReturnType<typeof setInterval> | null = null;

/** Whether the scheduler is currently running */
let isRunning = false;

// ---------------------------------------------------------------------------
// Signal processing
// ---------------------------------------------------------------------------

async function runSignalCycle(): Promise<void> {
  const assignments = await getActiveAssignments();
  if (assignments.length === 0) return;

  logger.debug({ count: assignments.length }, "Paper scheduler: processing signal cycle");

  for (const assignment of assignments) {
    try {
      await processAssignment(assignment);
    } catch (err) {
      logger.error(
        { err, assignmentId: assignment.id, strategyName: assignment.strategyName },
        "Paper scheduler: signal processing error",
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Mark-to-market cycle
// ---------------------------------------------------------------------------

async function runMtmCycle(): Promise<void> {
  const accounts = await listPaperAccounts("active");
  if (accounts.length === 0) return;

  logger.debug({ count: accounts.length }, "Paper scheduler: running MTM cycle");

  for (const account of accounts) {
    try {
      const openPositions = await getOpenPositions(account.id);
      if (openPositions.length === 0) continue;

      // Fetch current prices for all open position symbols
      const prices: Record<string, number> = {};
      const symbols = [...new Set(openPositions.map((p) => p.symbol))];

      for (const symbol of symbols) {
        const price = await getLivePrice(symbol, "1h");
        if (price !== null) prices[symbol] = price;
      }

      await markToMarket({ accountId: account.id, prices });
      await refreshPortfolio(account.id);
    } catch (err) {
      logger.error({ err, accountId: account.id }, "Paper scheduler: MTM error");
    }
  }
}

// ---------------------------------------------------------------------------
// Alert cycle
// ---------------------------------------------------------------------------

async function runAlertCycle(): Promise<void> {
  const accounts = await listPaperAccounts("active");
  for (const account of accounts) {
    try {
      await runAlertChecks(account.id);
    } catch (err) {
      logger.error({ err, accountId: account.id }, "Paper scheduler: alert check error");
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the paper trading scheduler.
 * Idempotent — calling multiple times has no effect.
 */
export function startPaperScheduler(): void {
  if (isRunning) {
    logger.info("Paper scheduler already running — skipping start");
    return;
  }

  isRunning = true;

  logger.info(
    {
      signalIntervalMs: SIGNAL_INTERVAL_MS,
      mtmIntervalMs: MTM_INTERVAL_MS,
      snapshotIntervalMs: SNAPSHOT_INTERVAL_MS,
      alertIntervalMs: ALERT_INTERVAL_MS,
    },
    "Paper trading scheduler starting",
  );

  // Run immediately on start, then on interval
  void runSignalCycle();
  void runMtmCycle();

  signalTimer = setInterval(() => void runSignalCycle(), SIGNAL_INTERVAL_MS);
  mtmTimer = setInterval(() => void runMtmCycle(), MTM_INTERVAL_MS);
  snapshotTimer = setInterval(() => void snapshotAllAccounts(), SNAPSHOT_INTERVAL_MS);
  alertTimer = setInterval(() => void runAlertCycle(), ALERT_INTERVAL_MS);

  logger.info("Paper trading scheduler started");
}

/**
 * Stop the paper trading scheduler gracefully.
 */
export function stopPaperScheduler(): void {
  if (!isRunning) return;

  if (signalTimer) { clearInterval(signalTimer); signalTimer = null; }
  if (mtmTimer) { clearInterval(mtmTimer); mtmTimer = null; }
  if (snapshotTimer) { clearInterval(snapshotTimer); snapshotTimer = null; }
  if (alertTimer) { clearInterval(alertTimer); alertTimer = null; }

  isRunning = false;
  logger.info("Paper trading scheduler stopped");
}

export function isPaperSchedulerRunning(): boolean {
  return isRunning;
}
