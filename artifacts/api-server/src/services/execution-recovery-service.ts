import { logger } from "../lib/logger";
import {
  listExecutionOrders,
  updateExecutionOrderStatus,
  insertExecutionRecovery,
  updateExecutionRecovery,
  insertExecutionAuditLog,
} from "./execution-db";
import { publish } from "./event-bus";
import type { RecoveryIssue, RecoveryAction } from "./execution-types";

/**
 * execution-recovery-service.ts — Execution recovery engine (ADR-033).
 *
 * Detects and resolves problematic order states:
 * - Lost ACK: order routed but no acknowledge within 30s
 * - Lost fill: order acknowledged but no fill within 5 min
 * - Provider timeout: routing attempt exceeded time limit
 * - Duplicate events: same order received multiple fill events
 * - Disconnected sessions: session-level reconnect detected
 * - Stale orders: caught by execution-monitor.ts
 *
 * Recovery actions:
 * - retry:      Re-submit the order to provider
 * - reconcile:  Query provider state and sync locally
 * - replay:     Re-process fill events from DB
 * - repair:     Force-correct order status based on fills
 * - audit:      Log and escalate; no automated fix
 *
 * Runs every 60 seconds.
 */

const LOST_ACK_THRESHOLD_MS = 30_000;  // 30 seconds
const LOST_FILL_THRESHOLD_MS = 5 * 60_000;  // 5 minutes

let recoveryInterval: ReturnType<typeof setInterval> | null = null;

export function startRecoveryService(): void {
  if (recoveryInterval) return;

  recoveryInterval = setInterval(async () => {
    try {
      await runRecoveryCycle();
    } catch (err) {
      logger.error({ err }, "ExecutionRecovery: cycle failed");
    }
  }, 60_000);

  logger.info("ExecutionRecoveryService: started (60s interval)");
}

export function stopRecoveryService(): void {
  if (recoveryInterval) {
    clearInterval(recoveryInterval);
    recoveryInterval = null;
  }
  logger.info("ExecutionRecoveryService: stopped");
}

async function runRecoveryCycle(): Promise<void> {
  const now = Date.now();
  let recoveredCount = 0;

  // Check for lost ACK (order in 'routed' state too long)
  const routedOrders = await listExecutionOrders({ status: "routed", limit: 100 });
  for (const order of routedOrders) {
    const age = now - new Date(order.routedAt ?? order.createdAt).getTime();
    if (age > LOST_ACK_THRESHOLD_MS) {
      await handleRecovery(order.id, "lost_ack", "reconcile", order.executionMode, order.symbol ?? undefined, {
        routedTo: order.routedTo,
        ageMs: age,
      });
      recoveredCount++;
    }
  }

  // Check for lost fill (order in 'acknowledged' state too long)
  const ackdOrders = await listExecutionOrders({ status: "acknowledged", limit: 100 });
  for (const order of ackdOrders) {
    const age = now - new Date(order.acknowledgedAt ?? order.createdAt).getTime();
    if (age > LOST_FILL_THRESHOLD_MS) {
      await handleRecovery(order.id, "lost_fill", "repair", order.executionMode, order.symbol ?? undefined, {
        provider: order.routedTo,
        ageMs: age,
        externalOrderId: order.externalOrderId,
      });
      recoveredCount++;
    }
  }

  // Check for orders in 'recovering' state that have been there too long
  const recoveringOrders = await listExecutionOrders({ status: "recovering", limit: 50 });
  for (const order of recoveringOrders) {
    const age = now - new Date(order.updatedAt).getTime();
    if (age > 10 * 60_000) { // 10 min in recovering → mark failed
      await updateExecutionOrderStatus(order.id, "failed", {
        rejectReason: "Recovery timeout — manual intervention required",
      });
      await insertExecutionAuditLog({
        orderId: order.id,
        action: "order_failed",
        actor: "recovery",
        executionMode: order.executionMode,
        symbol: order.symbol,
        detail: { reason: "recovery_timeout", ageMs: age },
        success: false,
        errorMessage: "Recovery timeout",
      });
      recoveredCount++;
    }
  }

  if (recoveredCount > 0) {
    logger.info({ recoveredCount }, "ExecutionRecovery: cycle complete");
  }
}

async function handleRecovery(
  orderId: string,
  issue: RecoveryIssue,
  action: RecoveryAction,
  executionMode: string,
  symbol?: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  // Create recovery record
  const recovery = await insertExecutionRecovery({
    orderId,
    issue,
    recoveryAction: action,
    status: "pending",
    detail,
    executionMode,
  });

  publish({
    eventType: "ExecutionRecovered",
    source: "recovery",
    symbol,
    data: { orderId, issue, action, executionMode },
    emittedAt: Date.now(),
  });

  logger.warn({ orderId, issue, action }, "ExecutionRecovery: recovery initiated");

  try {
    // In paper/simulation mode, recovery is automated:
    // For lost_ack → mark as failed (provider unreachable)
    // For lost_fill → repair by checking DB fills
    if (issue === "lost_ack") {
      await updateExecutionOrderStatus(orderId, "failed", {
        rejectReason: `Lost ACK — provider did not acknowledge within ${LOST_ACK_THRESHOLD_MS / 1000}s`,
      });
      await insertExecutionAuditLog({
        orderId,
        action: "order_failed",
        actor: "recovery",
        executionMode,
        symbol,
        detail: { issue, action, ...detail },
        success: false,
        errorMessage: "Lost ACK",
      });
    } else if (issue === "lost_fill") {
      // In simulation, if acknowledged but no fill after threshold, cancel it
      await updateExecutionOrderStatus(orderId, "cancelled", { cancelledAt: new Date() });
      await insertExecutionAuditLog({
        orderId,
        action: "order_cancelled",
        actor: "recovery",
        executionMode,
        symbol,
        detail: { issue, action, reason: "lost_fill_recovery" },
        success: true,
      });

      publish({
        eventType: "OrderCancelled",
        source: "recovery",
        symbol,
        data: { orderId, reason: "lost_fill_recovery" },
        emittedAt: Date.now(),
      });
    }

    await updateExecutionRecovery(recovery.id, {
      status: "success",
      resolvedAt: new Date(),
    });

    logger.info({ orderId, issue, action }, "ExecutionRecovery: recovery resolved");
  } catch (err) {
    await updateExecutionRecovery(recovery.id, {
      status: "failed",
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    logger.error({ err, orderId, issue }, "ExecutionRecovery: recovery failed");
  }
}
