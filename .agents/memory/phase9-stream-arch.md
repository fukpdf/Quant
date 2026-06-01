---
name: Phase 9 Stream Architecture
description: Key design rules for the Phase 9 real-time streaming infrastructure — provider abstraction, event bus, market state, tick processing, replay, and recovery.
---

## Rules

**Event bus does NOT log ticks individually.** Only lifecycle events (StreamConnected, GapDetected, RecoveryTriggered, etc.) are persisted to `event_bus_events`. Tick/orderbook/trade events are handled by their dedicated processors writing directly to `market_ticks`, `market_orderbooks`, `market_trades`. Persisting every tick via the bus would saturate the DB.

**Why:** At 4 symbols × 1 tick/sec, logging every tick event in the bus would be ~14,400 rows/hour in `event_bus_events` on top of what's already in `market_ticks`. The separation keeps each table focused and query-efficient.

**MockStreamProvider is the default.** STREAM_PROVIDER env var defaults to "mock". The mock generates realistic synthetic price walks via setInterval at 1 tick/sec per symbol. No network, no API key.

**BinanceWebSocketProvider uses lazy `ws` import.** The `ws` package is imported dynamically so the server starts even if `ws` is not installed. Only fails at connect() time if Binance provider is explicitly selected.

**Tick processor batches writes.** Batch size 20, flush every 2s. Order book is sampled (every 10th update). This keeps DB write pressure low at high tick rates.

**StreamScheduler is non-fatal.** Wrapped in try/catch in index.ts — server starts and serves all other APIs even if streaming fails to initialize.

**Market state is in-memory only during runtime.** MarketStateEngine Map<symbol, MarketState> is authoritative; snapshots to DB every 30s. On server restart, state resets and recovers within seconds when stream reconnects. API falls back to DB snapshot if streaming is inactive.

**Gap detection threshold is 10 seconds.** RecoveryService checks every 15s. If no tick received for a symbol in >10s, triggers backfill via BinanceClient.fetchKlines() (OHLCV 1m candles). Recovery events recorded in `stream_recovery_events`.

**How to apply:**
- Adding a new stream provider: implement IStreamProvider, add case to StreamProviderFactory. No other changes.
- Adding new stream event types: add to EventBusEventType union in stream-types.ts and HIGH_VOLUME_EVENTS set in event-bus.ts if needed.
- Phase 10 execution engine must NOT accept EventBus events as direct trading triggers (ADR-019 advisory boundary).
