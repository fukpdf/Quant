/**
 * scheduler-monitor.ts — Scheduler health tracking for Phase 12.
 *
 * Each scheduler calls recordSchedulerStart/recordSchedulerComplete to register runs.
 * The ops monitoring layer calls collectSchedulerHealth() to snapshot all known schedulers.
 */

import { logger } from "../lib/logger";
import { upsertSchedulerHealth, listLatestSchedulerHealth } from "./ops-db";

// ---------------------------------------------------------------------------
// In-memory state per scheduler
// ---------------------------------------------------------------------------

interface SchedulerState {
  schedulerName: string;
  phase: string;
  intervalMs: number;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastRuntimeMs: number | null;
  lastError: string | null;
  status: "ok" | "missed" | "failed" | "running";
  isActive: boolean;
  missedCount: number;
  failureCount: number;
  successCount: number;
  runStartedAt: Date | null;
}

const _schedulers = new Map<string, SchedulerState>();

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerScheduler(schedulerName: string, phase: string, intervalMs: number) {
  if (!_schedulers.has(schedulerName)) {
    _schedulers.set(schedulerName, {
      schedulerName,
      phase,
      intervalMs,
      lastRunAt: null,
      nextRunAt: new Date(Date.now() + intervalMs),
      lastRuntimeMs: null,
      lastError: null,
      status: "ok",
      isActive: true,
      missedCount: 0,
      failureCount: 0,
      successCount: 0,
      runStartedAt: null,
    });
  }
}

// ---------------------------------------------------------------------------
// Lifecycle hooks — called by each scheduler
// ---------------------------------------------------------------------------

export function recordSchedulerStart(schedulerName: string) {
  const s = _schedulers.get(schedulerName);
  if (!s) return;
  s.status = "running";
  s.runStartedAt = new Date();
}

export function recordSchedulerComplete(schedulerName: string) {
  const s = _schedulers.get(schedulerName);
  if (!s) return;
  const now = new Date();
  s.status = "ok";
  s.lastRunAt = now;
  s.nextRunAt = new Date(now.getTime() + s.intervalMs);
  s.lastRuntimeMs = s.runStartedAt ? now.getTime() - s.runStartedAt.getTime() : null;
  s.lastError = null;
  s.successCount++;
  s.runStartedAt = null;
}

export function recordSchedulerFailure(schedulerName: string, error: string) {
  const s = _schedulers.get(schedulerName);
  if (!s) return;
  const now = new Date();
  s.status = "failed";
  s.lastRunAt = now;
  s.nextRunAt = new Date(now.getTime() + s.intervalMs);
  s.lastRuntimeMs = s.runStartedAt ? now.getTime() - s.runStartedAt.getTime() : null;
  s.lastError = error.slice(0, 500);
  s.failureCount++;
  s.runStartedAt = null;
}

export function recordSchedulerMissed(schedulerName: string) {
  const s = _schedulers.get(schedulerName);
  if (!s) return;
  s.status = "missed";
  s.missedCount++;
}

export function markSchedulerInactive(schedulerName: string) {
  const s = _schedulers.get(schedulerName);
  if (s) s.isActive = false;
}

// ---------------------------------------------------------------------------
// Snapshot to DB
// ---------------------------------------------------------------------------

export async function persistAllSchedulerHealth(): Promise<void> {
  for (const [, state] of _schedulers) {
    try {
      await upsertSchedulerHealth({
        schedulerName: state.schedulerName,
        phase: state.phase,
        status: state.status,
        lastRunAt: state.lastRunAt ?? undefined,
        nextRunAt: state.nextRunAt ?? undefined,
        intervalMs: String(state.intervalMs),
        lastRuntimeMs: state.lastRuntimeMs !== null ? String(state.lastRuntimeMs) : null,
        missedCount: String(state.missedCount),
        failureCount: String(state.failureCount),
        successCount: String(state.successCount),
        isActive: state.isActive,
        lastError: state.lastError,
      });
    } catch (err) {
      logger.warn({ err, schedulerName: state.schedulerName }, "Failed to persist scheduler health");
    }
  }
}

// ---------------------------------------------------------------------------
// Query — latest snapshot per scheduler from DB
// ---------------------------------------------------------------------------

export async function getSchedulerHealthSummary() {
  const rows = await listLatestSchedulerHealth();
  return rows.map((r) => r.s);
}

// ---------------------------------------------------------------------------
// In-memory snapshot (no DB round-trip)
// ---------------------------------------------------------------------------

export function getInMemorySchedulerStates() {
  return Array.from(_schedulers.values());
}

// ---------------------------------------------------------------------------
// Pre-register all known schedulers
// ---------------------------------------------------------------------------

export function registerAllKnownSchedulers() {
  registerScheduler("ingestion_main", "phase1", 5 * 60_000);
  registerScheduler("ingestion_health", "phase1", 2 * 60_000);
  registerScheduler("ingestion_quality", "phase1", 60 * 60_000);
  registerScheduler("paper_signal", "phase5", 60_000);
  registerScheduler("paper_mtm", "phase5", 5 * 60_000);
  registerScheduler("paper_snapshot", "phase5", 60 * 60_000);
  registerScheduler("paper_alert", "phase5", 2 * 60_000);
  registerScheduler("risk_snapshot", "phase6", 5 * 60_000);
  registerScheduler("risk_correlation", "phase6", 15 * 60_000);
  registerScheduler("risk_scoring", "phase6", 30 * 60_000);
  registerScheduler("risk_drawdown", "phase6", 2 * 60_000);
  registerScheduler("analytics_performance", "phase7", 15 * 60_000);
  registerScheduler("analytics_health", "phase7", 10 * 60_000);
  registerScheduler("analytics_allocation", "phase7", 30 * 60_000);
  registerScheduler("stream_health", "phase9", 30_000);
  registerScheduler("stream_recovery", "phase9", 60_000);
  registerScheduler("execution_monitor", "phase10", 10_000);
  registerScheduler("execution_recovery", "phase10", 30_000);
  registerScheduler("intelligence_regime", "phase11", 60 * 60_000);
  registerScheduler("intelligence_rankings", "phase11", 6 * 60 * 60_000);
  registerScheduler("intelligence_clustering", "phase11", 12 * 60 * 60_000);
  registerScheduler("intelligence_coordination", "phase11", 30 * 60_000);
  registerScheduler("intelligence_learning", "phase11", 2 * 60 * 60_000);
  registerScheduler("ops_metrics", "phase12", 30_000);
  registerScheduler("ops_service_health", "phase12", 2 * 60_000);
  registerScheduler("ops_alert_evaluation", "phase12", 60_000);
  registerScheduler("ops_performance_snapshot", "phase12", 15 * 60_000);
}
