import { randomUUID } from "crypto";
import { logger } from "../lib/logger";
import { getTicksInRange } from "./stream-db";
import { publish, auditStreamAction } from "./event-bus";
import type { ReplayConfig, ReplayState, ReplaySpeed } from "./stream-types";

/**
 * replay-engine.ts — replays stored tick data at configurable speeds.
 *
 * Architecture (ADR-023):
 * - Reads market_ticks from DB for the given symbol/time range
 * - Fires TickReceived events at scaled time intervals
 * - Speed multipliers: 1x (realtime), 5x, 10x, 100x
 * - Used for: strategy testing, UI development, failure replay, debugging
 * - Max one active replay session at a time (single-process, personal platform)
 */

let currentReplay: ReplayState | null = null;
let replayAbortController: AbortController | null = null;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startReplay(config: ReplayConfig): ReplayState {
  if (currentReplay && currentReplay.status === "running") {
    throw new Error("A replay session is already running. Stop it first.");
  }

  const id = randomUUID();
  const state: ReplayState = {
    id,
    config,
    status: "idle",
    ticksReplayed: 0,
    totalTicks: 0,
    currentTime: null,
    startedAt: null,
    completedAt: null,
  };

  currentReplay = state;
  replayAbortController = new AbortController();

  // Run async; don't await here so API can return immediately
  void runReplay(id, config, replayAbortController.signal);

  return { ...state, status: "running", startedAt: Date.now() };
}

export function stopReplay(): { stopped: boolean; ticksReplayed: number } {
  if (!currentReplay || currentReplay.status !== "running") {
    return { stopped: false, ticksReplayed: 0 };
  }

  replayAbortController?.abort();
  const replayed = currentReplay.ticksReplayed;
  currentReplay.status = "paused";

  auditStreamAction("replay_stop", {
    replayId: currentReplay.id,
    ticksReplayed: replayed,
  });

  logger.info({ replayId: currentReplay.id, ticksReplayed: replayed }, "Replay stopped");
  return { stopped: true, ticksReplayed: replayed };
}

export function getReplayStatus(): ReplayState | null {
  return currentReplay;
}

export function getReplaySpeeds(): ReplaySpeed[] {
  return [1, 5, 10, 100];
}

// ---------------------------------------------------------------------------
// Internal: replay execution
// ---------------------------------------------------------------------------

async function runReplay(
  id: string,
  config: ReplayConfig,
  signal: AbortSignal,
): Promise<void> {
  if (!currentReplay) return;

  currentReplay.status = "running";
  currentReplay.startedAt = Date.now();

  auditStreamAction("replay_start", {
    replayId: id,
    symbol: config.symbol,
    from: config.fromTime,
    to: config.toTime,
    speed: config.speed,
  });

  publish({
    eventType: "ReplayStarted",
    source: "replay-engine",
    symbol: config.symbol,
    data: { replayId: id, from: config.fromTime, to: config.toTime, speed: config.speed },
    emittedAt: Date.now(),
  });

  try {
    const ticks = await getTicksInRange(config.symbol, config.fromTime, config.toTime);

    if (!currentReplay) return;
    currentReplay.totalTicks = ticks.length;

    logger.info({ replayId: id, tickCount: ticks.length, symbol: config.symbol }, "Replay: ticks loaded");

    let prevTime: number | null = null;

    for (const tick of ticks) {
      if (signal.aborted) {
        logger.info({ replayId: id }, "Replay: aborted");
        break;
      }

      const tickTime = new Date(tick.createdAt).getTime();

      // Inject inter-tick delay scaled by speed
      if (prevTime !== null) {
        const realGapMs = (tickTime - prevTime) / config.speed;
        const cappedGap = Math.min(realGapMs, 5000); // cap at 5s
        if (cappedGap > 5) {
          await sleep(cappedGap, signal);
        }
      }
      prevTime = tickTime;

      if (signal.aborted) break;

      // Emit as TickReceived event so all subscribers get it
      publish({
        eventType: "TickReceived",
        source: "replay-engine",
        symbol: tick.symbol,
        provider: tick.provider as ReplayConfig["speed"] extends number ? never : string as never,
        data: {
          price: tick.price,
          bidPrice: tick.bidPrice,
          askPrice: tick.askPrice,
          spread: tick.spread,
          volume: tick.volume,
          replayId: id,
          replayTimestamp: tick.createdAt,
        },
        emittedAt: Date.now(),
      });

      if (currentReplay) {
        currentReplay.ticksReplayed++;
        currentReplay.currentTime = new Date(tickTime);
      }
    }

    if (currentReplay && !signal.aborted) {
      currentReplay.status = "completed";
      currentReplay.completedAt = Date.now();

      publish({
        eventType: "ReplayStopped",
        source: "replay-engine",
        symbol: config.symbol,
        data: { replayId: id, ticksReplayed: currentReplay.ticksReplayed, reason: "completed" },
        emittedAt: Date.now(),
      });

      auditStreamAction("replay_complete", {
        replayId: id,
        ticksReplayed: currentReplay.ticksReplayed,
        totalTicks: currentReplay.totalTicks,
      });
    }
  } catch (err) {
    logger.error({ err, replayId: id }, "Replay engine error");
    if (currentReplay) {
      currentReplay.status = "failed";
      currentReplay.errorMessage = err instanceof Error ? err.message : String(err);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    }, { once: true });
  });
}
