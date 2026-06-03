import { logger } from "../lib/logger";
import { ACTIVE_ORDER_STATUSES, TERMINAL_ORDER_STATUSES } from "./execution-types";
import {
  listExecutionOrders,
  updateExecutionOrderStatus,
  insertExecutionRecovery,
  insertExecutionAuditLog,
  listPositions,
  updateExecutionPosition,
} from "./execution-db";
import { markToMarket } from "./execution-position-engine";
import { getMarketState } from "./market-state-engine";
import { publish } from "./event-bus";

/**
 * execution-monitor.ts — Active order and position surveillance (ADR-031).
 *
 * Runs on a polling interval (every 30s) to detect:
 * - Stale orders (acknowledged but no fill after threshold)
 * - Stuck orders (in non-terminal state for too long)
 * - Mark-to-market updates for open positions
 *
 * Stale order threshold: 5 minutes in acknowledged/partially_filled state
 * Stuck order threshold: 30 minutes in any active state
 */

const STALE_ORDER_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const STUCK_ORDER_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const MTM_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"];

let monitorInterval: ReturnType<typeof setInterval> | null = null;
let mtmInterval: ReturnType<typeof setInterval> | null = null;

export function startExecutionMonitor(): void {
  if (monitorInterval) return;

  monitorInterval = setInterval(async () => {
    try {
      await checkStaleOrders();
    } catch (err) {
      logger.error({ err }, "ExecutionMonitor: stale order check failed");
    }
  }, 30_000);

  mtmInterval = setInterval(async () => {
    try {
      await markAllPositionsToMarket();
    } catch (err) {
      logger.error({ err }, "ExecutionMonitor: MTM update failed");
    }
  }, 60_000);

  logger.info("ExecutionMonitor: started (stale check 30s, MTM 60s)");
}

export function stopExecutionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  if (mtmInterval) {
    clearInterval(mtmInterval);
    mtmInterval = null;
  }
  logger.info("ExecutionMonitor: stopped");
}

async function checkStaleOrders(): Promise<void> {
  const now = Date.now();

  // Get all active orders
  const activeOrders = await listExecutionOrders({
    status: ["acknowledged", "partially_filled", "routed", "recovering"],
    limit: 200,
  });

  let staleCount = 0;
  let stuckCount = 0;

  for (const order of activeOrders) {
    const orderAge = now - new Date(order.createdAt).getTime();
    const lastUpdate = now - new Date(order.updatedAt).getTime();

    // Stale: acknowledged/partially_filled but no fill update in 5 min
    if (
      (order.status === "acknowledged" || order.status === "partially_filled") &&
      lastUpdate > STALE_ORDER_THRESHOLD_MS
    ) {
      staleCount++;
      logger.warn(
        { orderId: order.id, symbol: order.symbol, ageMs: lastUpdate },
        "ExecutionMonitor: stale order detected",
      );

      await insertExecutionRecovery({
        orderId: order.id,
        issue: "stale_order",
        recoveryAction: "audit",
        status: "pending",
        detail: { ageMs: lastUpdate, status: order.status, symbol: order.symbol },
        provider: order.routedTo ?? undefined,
        executionMode: order.executionMode,
      });

      publish({
        eventType: "ExecutionRecovered",
        source: "monitor",
        symbol: order.symbol,
        data: { orderId: order.id, issue: "stale_order", ageMs: lastUpdate },
        emittedAt: now,
      });
    }

    // Stuck: any active state for more than 30 min — mark failed
    if (ACTIVE_ORDER_STATUSES.has(order.status as any) && orderAge > STUCK_ORDER_THRESHOLD_MS) {
      stuckCount++;
      logger.error(
        { orderId: order.id, symbol: order.symbol, ageMs: orderAge },
        "ExecutionMonitor: stuck order — marking failed",
      );

      await updateExecutionOrderStatus(order.id, "failed", {
        rejectReason: `Order stuck in ${order.status} for ${Math.round(orderAge / 60000)} minutes`,
      });

      await insertExecutionAuditLog({
        orderId: order.id,
        action: "order_failed",
        actor: "monitor",
        executionMode: order.executionMode,
        symbol: order.symbol,
        detail: { reason: "stuck_order", ageMs: orderAge, lastStatus: order.status },
        success: false,
        errorMessage: "Order stuck beyond threshold",
      });

      publish({
        eventType: "OrderFailed",
        source: "monitor",
        symbol: order.symbol,
        data: { orderId: order.id, reason: "stuck_order", ageMs: orderAge },
        emittedAt: now,
      });
    }
  }

  if (staleCount > 0 || stuckCount > 0) {
    logger.info({ staleCount, stuckCount }, "ExecutionMonitor: order health check complete");
  }
}

async function markAllPositionsToMarket(): Promise<void> {
  // Mark-to-market open positions for tracked symbols
  const openPositions = await listPositions({ status: "open", limit: 500 });

  for (const pos of openPositions) {
    const ms = getMarketState(pos.symbol);
    if (!ms) continue;

    const markPrice = String(ms.lastPrice);
    const avgEntry = parseFloat(pos.avgEntryPrice as string);
    const qty = parseFloat(pos.quantity as string);
    const markPriceF = parseFloat(markPrice);

    const unrealizedPnl = pos.side === "long"
      ? (markPriceF - avgEntry) * qty
      : (avgEntry - markPriceF) * qty;

    await updateExecutionPosition(pos.id, {
      currentPrice: markPrice,
      unrealizedPnl: unrealizedPnl.toFixed(8),
    });
  }
}

/**
 * Get summary of current order book state (for health endpoint).
 */
export async function getOrderBookSummary() {
  const allActive = await listExecutionOrders({
    status: Array.from(ACTIVE_ORDER_STATUSES),
    limit: 1000,
  });

  const byStatus: Record<string, number> = {};
  for (const o of allActive) {
    byStatus[o.status] = (byStatus[o.status] ?? 0) + 1;
  }

  return {
    totalActive: allActive.length,
    byStatus,
  };
}
