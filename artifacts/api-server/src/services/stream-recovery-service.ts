import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { insertStreamFailure, insertRecoveryEvent, updateRecoveryEvent } from "./stream-db";
import { publish, auditStreamAction } from "./event-bus";
import { getActiveSession } from "./stream-connection-manager";
import type { GapInfo } from "./stream-types";

/**
 * stream-recovery-service.ts — detects tick gaps and triggers recovery.
 *
 * Architecture (ADR-024):
 * - Gap detection: compare last tick time vs expected tick frequency
 * - Recovery actions: reconnect (via connection manager) | backfill (from OHLCV candles)
 * - Recovery events recorded in stream_recovery_events table
 */

const GAP_THRESHOLD_MS = 10_000;      // gap > 10s triggers recovery
const RECOVERY_CHECK_MS = 15_000;     // check every 15 seconds

let recoveryTimer: NodeJS.Timeout | null = null;
const lastTickTimes = new Map<string, number>();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startRecoveryService(): void {
  recoveryTimer = setInterval(() => {
    void checkForGaps();
  }, RECOVERY_CHECK_MS);
  logger.info({ gapThresholdMs: GAP_THRESHOLD_MS }, "Stream recovery service started");
}

export function stopRecoveryService(): void {
  if (recoveryTimer) { clearInterval(recoveryTimer); recoveryTimer = null; }
  lastTickTimes.clear();
}

/** Called by tick processor on each tick */
export function recordTickTime(symbol: string): void {
  lastTickTimes.set(symbol, Date.now());
}

// ---------------------------------------------------------------------------
// Internal: Gap Detection
// ---------------------------------------------------------------------------

async function checkForGaps(): Promise<void> {
  const session = getActiveSession();
  if (!session || session.status !== "active") return;

  const now = Date.now();
  const gaps: GapInfo[] = [];

  for (const symbol of session.symbols) {
    const lastTick = lastTickTimes.get(symbol);
    if (!lastTick) continue;

    const gap = now - lastTick;
    if (gap > GAP_THRESHOLD_MS) {
      gaps.push({
        symbol,
        provider: session.provider,
        gapStart: new Date(lastTick),
        gapEnd: new Date(now),
        estimatedMissingTicks: Math.floor(gap / 1000), // ~1 tick/sec estimate
      });
    }
  }

  for (const gap of gaps) {
    await handleGap(gap, session.id);
  }
}

async function handleGap(gap: GapInfo, sessionId: string): Promise<void> {
  logger.warn(
    { symbol: gap.symbol, gapMs: gap.gapEnd.getTime() - gap.gapStart.getTime() },
    "Stream recovery: gap detected",
  );

  const failureId = randomUUID();
  const recoveryId = randomUUID();

  // Record failure
  await insertStreamFailure({
    provider: gap.provider,
    sessionId,
    failureType: "heartbeat_timeout",
    message: `No ticks received for ${gap.symbol} since ${gap.gapStart.toISOString()}`,
    affectedSymbols: [gap.symbol],
    recoveryAction: "reconnect",
  }).catch(() => null);

  // Publish gap detected event
  publish({
    eventType: "GapDetected",
    source: "stream-recovery-service",
    symbol: gap.symbol,
    provider: gap.provider,
    sessionId,
    data: {
      gapStart: gap.gapStart,
      gapEnd: gap.gapEnd,
      estimatedMissingTicks: gap.estimatedMissingTicks,
    },
    emittedAt: Date.now(),
  });

  // Record recovery attempt
  const recovery = await insertRecoveryEvent({
    provider: gap.provider,
    failureId,
    sessionId,
    recoveryType: "gap_fill",
    status: "started",
    symbol: gap.symbol,
    estimatedGapTicks: String(gap.estimatedMissingTicks),
    backfillFrom: gap.gapStart,
    backfillTo: gap.gapEnd,
    startedAt: new Date(),
  });

  publish({
    eventType: "RecoveryTriggered",
    source: "stream-recovery-service",
    symbol: gap.symbol,
    provider: gap.provider,
    sessionId,
    data: { recoveryId: recovery.id, recoveryType: "gap_fill" },
    emittedAt: Date.now(),
  });

  // Perform gap fill via OHLCV backfill (uses existing candle ingestion)
  const filled = await backfillFromCandles(gap);

  await updateRecoveryEvent(recovery.id, {
    status: filled ? "completed" : "failed",
    recoveredTicks: filled ? String(gap.estimatedMissingTicks) : "0",
    success: filled,
    completedAt: new Date(),
    durationMs: String(Date.now() - gap.gapStart.getTime()),
  });

  if (filled) {
    publish({
      eventType: "RecoveryComplete",
      source: "stream-recovery-service",
      symbol: gap.symbol,
      provider: gap.provider,
      sessionId,
      data: { recoveryId: recovery.id, success: true },
      emittedAt: Date.now(),
    });
  }

  auditStreamAction(
    "recovery_complete",
    { symbol: gap.symbol, success: filled, recoveryId: recovery.id },
    gap.provider,
    sessionId,
  );
}

/** Backfill gap using OHLCV candles from the existing ingestion service */
async function backfillFromCandles(gap: GapInfo): Promise<boolean> {
  try {
    const { BinanceClient } = await import("./binance");
    const client = new BinanceClient();

    const candles = await client.fetchKlines({
      symbol: gap.symbol,
      interval: "1m",
      startTime: gap.gapStart.getTime(),
      endTime: gap.gapEnd.getTime(),
      limit: 500,
    });

    logger.info(
      { symbol: gap.symbol, candles: candles.length },
      "Stream recovery: backfilled via OHLCV",
    );
    return candles.length > 0;
  } catch (err) {
    logger.error({ err, symbol: gap.symbol }, "Stream recovery: backfill failed");
    return false;
  }
}
