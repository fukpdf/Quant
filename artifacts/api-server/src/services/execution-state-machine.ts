import { logger } from "../lib/logger";
import {
  type OrderStatus,
  ORDER_TRANSITIONS,
  TERMINAL_ORDER_STATUSES,
} from "./execution-types";
import { insertExecutionOrderEvent, updateExecutionOrderStatus } from "./execution-db";

/**
 * execution-state-machine.ts — Order lifecycle state machine (ADR-026).
 *
 * Enforces valid state transitions for every execution order.
 * Every transition is persisted to execution_order_events (immutable).
 * Terminal states cannot transition further.
 *
 * States: created → validated → risk_approved → routed → acknowledged →
 *         partially_filled → filled | cancelled | rejected | failed | recovering
 */

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  const allowed = ORDER_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.has(status);
}

interface TransitionOptions {
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  event: string;
  actor?: string;
  detail?: Record<string, unknown>;
  latencyMs?: number;
  /** If true, also updates execution_orders.status */
  persist?: boolean;
  /** Extra fields to update on execution_orders alongside status */
  orderUpdate?: Parameters<typeof updateExecutionOrderStatus>[2];
}

/**
 * Attempt a state transition. Validates, persists the event, and updates the order.
 * Throws if the transition is invalid.
 */
export async function transition(opts: TransitionOptions): Promise<void> {
  const { orderId, fromStatus, toStatus, event, actor = "oms", detail, latencyMs, persist = true, orderUpdate = {} } = opts;

  if (!isValidTransition(fromStatus, toStatus)) {
    const msg = `Invalid transition: ${fromStatus} → ${toStatus} for order ${orderId} (event: ${event})`;
    logger.warn({ orderId, fromStatus, toStatus, event }, msg);
    throw new Error(msg);
  }

  // Persist the order event (immutable audit record)
  await insertExecutionOrderEvent({
    orderId,
    fromStatus,
    toStatus,
    event,
    actor,
    detail: detail ?? null,
    latencyMs: latencyMs != null ? String(latencyMs) : null,
  });

  // Update the order status (and any extra fields)
  if (persist) {
    await updateExecutionOrderStatus(orderId, toStatus, orderUpdate);
  }

  logger.debug({ orderId, fromStatus, toStatus, event, actor }, "Order state transition");
}

/**
 * Record a transition that was already applied (e.g. in recovery).
 * Does NOT update the order status — only writes the event record.
 */
export async function recordTransitionEvent(opts: Omit<TransitionOptions, "persist" | "orderUpdate">): Promise<void> {
  const { orderId, fromStatus, toStatus, event, actor = "oms", detail, latencyMs } = opts;

  await insertExecutionOrderEvent({
    orderId,
    fromStatus,
    toStatus,
    event,
    actor,
    detail: detail ?? null,
    latencyMs: latencyMs != null ? String(latencyMs) : null,
  });
}
