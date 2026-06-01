import { logger } from "../lib/logger";
import { createKillSwitchEvent, appendAuditLog, createRiskEvent } from "./risk-db";

/**
 * In-memory kill switch state.
 * Provides immediate effect without a DB round-trip on every order check.
 * Persisted to kill_switch_events for audit trail.
 *
 * State is authoritative until server restart — by design for a paper trading system.
 * Phase 8 will require persistent distributed state (Redis or DB polling).
 */

interface KillSwitchState {
  /** Global trading halt — all orders blocked */
  tradingHalted: boolean;
  /** Scheduler paused — no new signals processed */
  schedulerPaused: boolean;
  /** Per-account halt — accountId → halted */
  haltedAccounts: Set<string>;
  /** Per-strategy halt — strategyName → halted */
  haltedStrategies: Set<string>;
}

const state: KillSwitchState = {
  tradingHalted: false,
  schedulerPaused: false,
  haltedAccounts: new Set(),
  haltedStrategies: new Set(),
};

// ---------------------------------------------------------------------------
// Read state
// ---------------------------------------------------------------------------

export function isTradingHalted(): boolean {
  return state.tradingHalted;
}

export function isSchedulerPaused(): boolean {
  return state.schedulerPaused;
}

export function isAccountHalted(accountId: string): boolean {
  return state.tradingHalted || state.haltedAccounts.has(accountId);
}

export function isStrategyHalted(strategyName: string): boolean {
  return state.tradingHalted || state.haltedStrategies.has(strategyName);
}

export function getKillSwitchStatus(): {
  tradingHalted: boolean;
  schedulerPaused: boolean;
  haltedAccounts: string[];
  haltedStrategies: string[];
} {
  return {
    tradingHalted: state.tradingHalted,
    schedulerPaused: state.schedulerPaused,
    haltedAccounts: Array.from(state.haltedAccounts),
    haltedStrategies: Array.from(state.haltedStrategies),
  };
}

// ---------------------------------------------------------------------------
// Activate kill switch
// ---------------------------------------------------------------------------

export async function activateKillSwitch(opts: {
  scope: "strategy" | "account" | "portfolio" | "trading" | "scheduler";
  targetId?: string;
  targetLabel?: string;
  reason: string;
}): Promise<void> {
  const { scope, targetId, targetLabel, reason } = opts;

  switch (scope) {
    case "trading":
      state.tradingHalted = true;
      logger.warn({ reason }, "KILL SWITCH: global trading halted");
      break;
    case "scheduler":
      state.schedulerPaused = true;
      logger.warn({ reason }, "KILL SWITCH: paper scheduler paused");
      break;
    case "account":
      if (targetId) {
        state.haltedAccounts.add(targetId);
        logger.warn({ accountId: targetId, reason }, "KILL SWITCH: account trading halted");
      }
      break;
    case "strategy":
      if (targetId) {
        state.haltedStrategies.add(targetId);
        logger.warn({ strategyName: targetId, reason }, "KILL SWITCH: strategy trading halted");
      }
      break;
    case "portfolio":
      // Portfolio-level halt = halt all accounts that are active
      // For paper trading, this maps to global halt
      state.tradingHalted = true;
      logger.warn({ reason }, "KILL SWITCH: portfolio-level trading halted");
      break;
  }

  // Persist event
  await createKillSwitchEvent({
    scope,
    action: "activate",
    targetId: targetId ?? null,
    targetLabel: targetLabel ?? null,
    reason,
    activatedAt: new Date(),
    resumedAt: null,
  });

  // Create risk event for visibility
  await createRiskEvent({
    accountId: scope === "account" ? targetId ?? null : null,
    strategyName: scope === "strategy" ? targetId ?? null : null,
    eventType: "kill_switch_activated",
    severity: "critical",
    message: `Kill switch activated: scope=${scope}${targetId ? `, target=${targetId}` : ""}. Reason: ${reason}`,
    payload: { scope, targetId, reason },
    resolved: false,
  });

  await appendAuditLog({
    actor: "api",
    action: `kill_switch.activate.${scope}`,
    entityType: scope,
    entityId: targetId,
    payload: { scope, targetId, targetLabel, reason },
    result: "success",
  });
}

// ---------------------------------------------------------------------------
// Resume (deactivate) kill switch
// ---------------------------------------------------------------------------

export async function resumeKillSwitch(opts: {
  scope: "strategy" | "account" | "portfolio" | "trading" | "scheduler";
  targetId?: string;
  reason: string;
}): Promise<void> {
  const { scope, targetId, reason } = opts;

  switch (scope) {
    case "trading":
      state.tradingHalted = false;
      logger.info({ reason }, "KILL SWITCH: global trading resumed");
      break;
    case "scheduler":
      state.schedulerPaused = false;
      logger.info({ reason }, "KILL SWITCH: paper scheduler resumed");
      break;
    case "account":
      if (targetId) {
        state.haltedAccounts.delete(targetId);
        logger.info({ accountId: targetId, reason }, "KILL SWITCH: account trading resumed");
      }
      break;
    case "strategy":
      if (targetId) {
        state.haltedStrategies.delete(targetId);
        logger.info({ strategyName: targetId, reason }, "KILL SWITCH: strategy trading resumed");
      }
      break;
    case "portfolio":
      state.tradingHalted = false;
      logger.info({ reason }, "KILL SWITCH: portfolio-level trading resumed");
      break;
  }

  await createKillSwitchEvent({
    scope,
    action: "resume",
    targetId: targetId ?? null,
    targetLabel: null,
    reason,
    activatedAt: null,
    resumedAt: new Date(),
  });

  await appendAuditLog({
    actor: "api",
    action: `kill_switch.resume.${scope}`,
    entityType: scope,
    entityId: targetId,
    payload: { scope, targetId, reason },
    result: "success",
  });
}
