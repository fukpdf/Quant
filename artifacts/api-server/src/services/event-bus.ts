import { EventEmitter } from "events";
import { logger } from "../lib/logger";
import { insertEventBusEvent, insertStreamAudit } from "./stream-db";
import type { EventBusEventType, EventBusPayload } from "./stream-types";

/**
 * event-bus.ts — internal in-memory event bus for the streaming infrastructure.
 *
 * Architecture (ADR-020):
 * - EventEmitter-based: zero dependencies, no Redis required
 * - All significant lifecycle events are persisted to DB for audit/replay
 * - Tick events are NOT individually persisted (too high volume); they are
 *   persisted by the tick processor directly to market_ticks
 * - Supports subscribe, publish, replay (from DB), and metrics
 */

const HIGH_VOLUME_EVENTS = new Set<EventBusEventType>([
  "TickReceived",
  "OrderBookUpdated",
  "TradeReceived",
]);

// Singleton emitter
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

// ---------------------------------------------------------------------------
// Publish
// ---------------------------------------------------------------------------

export function publish(payload: EventBusPayload): void {
  const start = Date.now();
  emitter.emit(payload.eventType, payload);
  emitter.emit("*", payload);

  const processingMs = Date.now() - start;

  // Persist lifecycle/state events; skip high-volume tick events
  if (!HIGH_VOLUME_EVENTS.has(payload.eventType)) {
    const subscriberCount = emitter.listenerCount(payload.eventType);
    insertEventBusEvent({
      eventType: payload.eventType,
      source: payload.source,
      payload: payload.data as Record<string, unknown>,
      symbol: payload.symbol,
      provider: payload.provider,
      sessionId: payload.sessionId,
      actionTriggered: false,
      subscriberCount: String(subscriberCount),
      processingMs: String(processingMs),
    }).catch((err) => logger.error({ err }, "EventBus: failed to persist event"));
  }
}

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

export function subscribe(
  eventType: EventBusEventType | "*",
  handler: (payload: EventBusPayload) => void,
): () => void {
  emitter.on(eventType, handler);
  // Return unsubscribe function
  return () => {
    emitter.off(eventType, handler);
  };
}

export function subscribeOnce(
  eventType: EventBusEventType,
  handler: (payload: EventBusPayload) => void,
): void {
  emitter.once(eventType, handler);
}

// ---------------------------------------------------------------------------
// Replay — replays stored lifecycle events from the DB
// ---------------------------------------------------------------------------

export async function replayEvents(
  eventTypes: EventBusEventType[],
  fromTime: Date,
  toTime: Date,
  speedMultiplier: 1 | 5 | 10 | 100 = 1,
): Promise<{ replayed: number }> {
  const { getEventBusEvents } = await import("./stream-db");
  const events: EventBusPayload[] = [];

  for (const eventType of eventTypes) {
    const rows = await getEventBusEvents(eventType, 10000);
    for (const row of rows) {
      const rowTime = new Date(row.createdAt);
      if (rowTime >= fromTime && rowTime <= toTime) {
        events.push({
          eventType: row.eventType as EventBusEventType,
          source: row.source,
          symbol: row.symbol ?? undefined,
          provider: row.provider as EventBusPayload["provider"],
          sessionId: row.sessionId ?? undefined,
          data: (row.payload as Record<string, unknown>) ?? {},
          emittedAt: rowTime.getTime(),
        });
      }
    }
  }

  events.sort((a, b) => a.emittedAt - b.emittedAt);

  // Replay with speed multiplier
  let replayed = 0;
  let prevTime: number | null = null;

  for (const event of events) {
    if (prevTime !== null) {
      const realGapMs = (event.emittedAt - prevTime) / speedMultiplier;
      if (realGapMs > 0 && realGapMs < 5000) {
        await new Promise((r) => setTimeout(r, realGapMs));
      }
    }
    emitter.emit(event.eventType, event);
    emitter.emit("*", event);
    prevTime = event.emittedAt;
    replayed++;
  }

  return { replayed };
}

// ---------------------------------------------------------------------------
// Audit helpers
// ---------------------------------------------------------------------------

export function auditStreamAction(
  action: string,
  detail: Record<string, unknown>,
  provider?: string,
  sessionId?: string,
  success = true,
  errorMessage?: string,
): void {
  insertStreamAudit({
    action,
    provider,
    sessionId,
    actor: "system",
    detail,
    success,
    errorMessage,
  }).catch((err) => logger.error({ err }, "EventBus: failed to write stream audit"));
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function getListenerCount(eventType: EventBusEventType | "*"): number {
  return emitter.listenerCount(eventType);
}

export function getAllEventTypes(): string[] {
  return emitter.eventNames().map((e) => String(e));
}
