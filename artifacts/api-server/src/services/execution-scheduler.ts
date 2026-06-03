import { logger } from "../lib/logger";
import { DEFAULT_EXECUTION_MODE, VALID_EXECUTION_MODES } from "./execution-types";
import { upsertDefaultExecutionAccount, insertExecutionSession, insertExecutionAuditLog, getActiveExecutionSession } from "./execution-db";
import { startExecutionMonitor, stopExecutionMonitor } from "./execution-monitor";
import { startAnalyticsEngine, stopAnalyticsEngine } from "./execution-analytics-engine";
import { startRecoveryService, stopRecoveryService } from "./execution-recovery-service";

/**
 * execution-scheduler.ts — Master startup entry point for Phase 10 OMS.
 *
 * SAFETY (ADR-025):
 * - Reads EXECUTION_MODE from environment (default: simulation)
 * - Validates mode is one of: simulation | paper | live_disabled
 * - If mode is invalid, refuses to start the execution engine
 * - LIVE trading is permanently disabled — the mode "live" is not accepted
 *
 * On startup:
 * 1. Validate execution mode
 * 2. Upsert default execution account for the configured mode
 * 3. Create execution session record
 * 4. Start execution monitor (stale order detection, MTM)
 * 5. Start analytics engine (metrics computation)
 * 6. Start recovery service (lost ACK/fill detection)
 *
 * Non-fatal: server continues without OMS if initialization fails.
 */

const RAW_MODE = process.env["EXECUTION_MODE"] ?? DEFAULT_EXECUTION_MODE;
const EXECUTION_ENABLED = (process.env["EXECUTION_ENABLED"] ?? "true") === "true";

let started = false;
let currentSessionId: string | null = null;
let currentMode: string | null = null;

export function getExecutionMode(): string {
  return currentMode ?? RAW_MODE;
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

export async function startExecutionScheduler(): Promise<void> {
  if (!EXECUTION_ENABLED) {
    logger.info("EXECUTION_ENABLED=false — execution engine skipped");
    return;
  }

  if (started) {
    logger.warn("Execution scheduler already started — skipping");
    return;
  }

  // Validate execution mode
  if (!VALID_EXECUTION_MODES.includes(RAW_MODE as any)) {
    logger.error(
      { mode: RAW_MODE, validModes: VALID_EXECUTION_MODES },
      "EXECUTION_MODE is invalid — execution engine refused to start. Set EXECUTION_MODE to: simulation | paper | live_disabled",
    );
    throw new Error(
      `Invalid EXECUTION_MODE="${RAW_MODE}". Must be one of: ${VALID_EXECUTION_MODES.join(" | ")}. ` +
      `Live trading is not supported in Phase 10.`,
    );
  }

  if ((RAW_MODE as string) === "live_disabled") {
    logger.warn(
      "EXECUTION_MODE=live_disabled — OMS will start but all orders are blocked at provider level. No real-money execution.",
    );
  }

  started = true;
  currentMode = RAW_MODE;

  logger.info({ mode: RAW_MODE }, "Starting Phase 10 execution infrastructure");

  // Upsert default execution account for this mode
  try {
    const accountId = await upsertDefaultExecutionAccount(RAW_MODE);
    logger.info({ accountId, mode: RAW_MODE }, "Execution account ready");

    // Create session record
    const activeSession = await getActiveExecutionSession(RAW_MODE);
    if (!activeSession) {
      const session = await insertExecutionSession({
        executionMode: RAW_MODE,
        provider: RAW_MODE === "paper" ? "paper" : "mock",
        status: "active",
        ordersPlaced: "0",
        ordersFilled: "0",
        ordersRejected: "0",
        ordersCancelled: "0",
        fillsProcessed: "0",
      });
      currentSessionId = session.id;
      logger.info({ sessionId: session.id, mode: RAW_MODE }, "Execution session created");

      await insertExecutionAuditLog({
        action: "session_started",
        actor: "scheduler",
        executionMode: RAW_MODE,
        detail: { mode: RAW_MODE, provider: RAW_MODE === "paper" ? "paper" : "mock", sessionId: session.id },
        success: true,
      });
    } else {
      currentSessionId = activeSession.id;
      logger.info({ sessionId: activeSession.id }, "Resuming existing execution session");
    }
  } catch (err) {
    logger.error({ err }, "Execution account/session setup failed — continuing");
  }

  // Start monitoring components
  startExecutionMonitor();
  startAnalyticsEngine();
  startRecoveryService();

  logger.info({ mode: RAW_MODE, sessionId: currentSessionId }, "Phase 10 execution infrastructure ready");
}

export async function stopExecutionScheduler(): Promise<void> {
  if (!started) return;

  stopExecutionMonitor();
  stopAnalyticsEngine();
  stopRecoveryService();

  started = false;
  logger.info("Phase 10 execution infrastructure stopped");
}
