import { logger } from "../lib/logger";
import { createCircuitBreakerEvent, createRiskEvent, appendAuditLog } from "./risk-db";

/**
 * Circuit Breaker Service — Phase 6.
 *
 * Manages in-memory circuit breaker states with persistence to DB.
 * A triggered breaker blocks all orders for the affected account/strategy.
 *
 * Breaker types:
 *   loss_streak         — N consecutive losing trades
 *   drawdown            — drawdown exceeds threshold
 *   execution_failure   — N consecutive fill failures
 *   volatility          — market volatility exceeds threshold (placeholder)
 *   data_failure        — data staleness / missing candles
 *   market_closure      — market detected as closed (placeholder)
 */

export type BreakerType =
  | "loss_streak"
  | "drawdown"
  | "execution_failure"
  | "volatility"
  | "data_failure"
  | "market_closure";

export type BreakerState = "active" | "triggered" | "recovering" | "disabled";

interface Breaker {
  type: BreakerType;
  state: BreakerState;
  accountId?: string;
  strategyName?: string;
  triggeredValue?: number;
  threshold?: number;
  reason?: string;
  triggeredAt?: Date;
}

/** Key: `${type}:${accountId ?? "global"}:${strategyName ?? "any"}` */
const breakers = new Map<string, Breaker>();

/** Running counters for streak-based breakers */
const lossStreaks = new Map<string, number>();
const execFailureStreaks = new Map<string, number>();

// Default thresholds
const LOSS_STREAK_THRESHOLD = 5;
const EXEC_FAILURE_THRESHOLD = 3;
const DRAWDOWN_THRESHOLD_PCT = 15;
const DATA_FAILURE_THRESHOLD = 3;

function breakerKey(type: BreakerType, accountId?: string, strategyName?: string): string {
  return `${type}:${accountId ?? "global"}:${strategyName ?? "any"}`;
}

export function getBreakerState(
  type: BreakerType,
  accountId?: string,
  strategyName?: string,
): BreakerState {
  const key = breakerKey(type, accountId, strategyName);
  return breakers.get(key)?.state ?? "active";
}

export function isCircuitBreakerTriggered(accountId: string): boolean {
  for (const [, breaker] of breakers) {
    if (breaker.state === "triggered") {
      if (!breaker.accountId || breaker.accountId === accountId) {
        return true;
      }
    }
  }
  return false;
}

export function getAllBreakerStates(): Breaker[] {
  return Array.from(breakers.values());
}

async function triggerBreaker(opts: {
  type: BreakerType;
  accountId?: string;
  strategyName?: string;
  triggeredValue: number;
  threshold: number;
  reason: string;
}): Promise<void> {
  const { type, accountId, strategyName, triggeredValue, threshold, reason } = opts;
  const key = breakerKey(type, accountId, strategyName);

  const existing = breakers.get(key);
  if (existing?.state === "triggered") return; // already triggered

  const breaker: Breaker = {
    type,
    state: "triggered",
    accountId,
    strategyName,
    triggeredValue,
    threshold,
    reason,
    triggeredAt: new Date(),
  };
  breakers.set(key, breaker);

  logger.warn(
    { type, accountId, strategyName, triggeredValue, threshold },
    `Circuit breaker TRIGGERED: ${type}`,
  );

  await createCircuitBreakerEvent({
    breakerType: type,
    state: "triggered",
    accountId: accountId ?? null,
    strategyName: strategyName ?? null,
    triggeredValue: String(triggeredValue),
    threshold: String(threshold),
    reason,
    triggeredAt: new Date(),
    recoveredAt: null,
  });

  await createRiskEvent({
    accountId: accountId ?? null,
    strategyName: strategyName ?? null,
    eventType: "circuit_breaker_triggered",
    severity: "critical",
    message: `Circuit breaker triggered: ${type}. Value=${triggeredValue}, Threshold=${threshold}. ${reason}`,
    payload: { type, triggeredValue, threshold, reason },
    resolved: false,
  });

  await appendAuditLog({
    actor: "system",
    action: `circuit_breaker.trigger.${type}`,
    entityType: "circuit_breaker",
    entityId: key,
    payload: { type, accountId, strategyName, triggeredValue, threshold, reason },
    result: "success",
  });
}

export async function resetBreaker(
  type: BreakerType,
  accountId?: string,
  strategyName?: string,
): Promise<void> {
  const key = breakerKey(type, accountId, strategyName);
  const existing = breakers.get(key);
  if (!existing) return;

  existing.state = "active";
  existing.triggeredAt = undefined;
  existing.reason = undefined;
  breakers.set(key, existing);

  // Reset streak counters on recovery
  if (type === "loss_streak") {
    lossStreaks.set(`${accountId}:${strategyName}`, 0);
  }
  if (type === "execution_failure") {
    execFailureStreaks.set(`${accountId}:${strategyName}`, 0);
  }

  logger.info({ type, accountId, strategyName }, "Circuit breaker RESET to active");

  await createCircuitBreakerEvent({
    breakerType: type,
    state: "active",
    accountId: accountId ?? null,
    strategyName: strategyName ?? null,
    triggeredValue: null,
    threshold: null,
    reason: "Manual reset / recovery",
    triggeredAt: null,
    recoveredAt: new Date(),
  });
}

// ---------------------------------------------------------------------------
// Public check functions — called from the risk engine and scheduler
// ---------------------------------------------------------------------------

/**
 * Record a trade outcome and check if loss streak breaker should fire.
 * Call after each closed trade.
 */
export async function recordTradeOutcome(
  accountId: string,
  strategyName: string,
  isWin: boolean,
): Promise<void> {
  const key = `${accountId}:${strategyName}`;
  const current = lossStreaks.get(key) ?? 0;

  if (isWin) {
    lossStreaks.set(key, 0);
  } else {
    const newStreak = current + 1;
    lossStreaks.set(key, newStreak);

    if (newStreak >= LOSS_STREAK_THRESHOLD) {
      await triggerBreaker({
        type: "loss_streak",
        accountId,
        strategyName,
        triggeredValue: newStreak,
        threshold: LOSS_STREAK_THRESHOLD,
        reason: `${newStreak} consecutive losing trades`,
      });
    }
  }
}

/**
 * Record an execution attempt outcome and check failure streak breaker.
 */
export async function recordExecutionOutcome(
  accountId: string,
  success: boolean,
): Promise<void> {
  const key = `${accountId}:exec`;
  const current = execFailureStreaks.get(key) ?? 0;

  if (success) {
    execFailureStreaks.set(key, 0);
  } else {
    const newStreak = current + 1;
    execFailureStreaks.set(key, newStreak);

    if (newStreak >= EXEC_FAILURE_THRESHOLD) {
      await triggerBreaker({
        type: "execution_failure",
        accountId,
        triggeredValue: newStreak,
        threshold: EXEC_FAILURE_THRESHOLD,
        reason: `${newStreak} consecutive execution failures`,
      });
    }
  }
}

/**
 * Check drawdown-based circuit breaker.
 * Called by the drawdown monitor on each MTM cycle.
 */
export async function checkDrawdownBreaker(
  accountId: string,
  drawdownPct: number,
): Promise<void> {
  if (drawdownPct >= DRAWDOWN_THRESHOLD_PCT) {
    await triggerBreaker({
      type: "drawdown",
      accountId,
      triggeredValue: drawdownPct,
      threshold: DRAWDOWN_THRESHOLD_PCT,
      reason: `Account drawdown ${drawdownPct.toFixed(2)}% exceeds circuit breaker threshold ${DRAWDOWN_THRESHOLD_PCT}%`,
    });
  }
}

/**
 * Check data freshness circuit breaker.
 * Call when candle data is detected as stale.
 */
export async function checkDataFreshnessBreaker(
  symbol: string,
  ageMinutes: number,
  thresholdMinutes = 15,
): Promise<void> {
  if (ageMinutes >= thresholdMinutes) {
    await triggerBreaker({
      type: "data_failure",
      strategyName: symbol,
      triggeredValue: ageMinutes,
      threshold: thresholdMinutes,
      reason: `Data for ${symbol} is ${ageMinutes.toFixed(1)} minutes old (threshold: ${thresholdMinutes} min)`,
    });
  }
}
