import { logger } from "../lib/logger";
import type { IExecutionProvider, ExecutionMode, ProviderHealthStatus } from "./execution-types";
import { MockExecutionProvider } from "./mock-execution-provider";
import { getPaperExecutionProvider } from "./paper-execution-provider";

/**
 * execution-router.ts — Provider registry and routing factory (ADR-027).
 *
 * Selects the correct IExecutionProvider for a given execution mode.
 * Providers are singletons — one instance per mode per process lifetime.
 *
 * Routing rules:
 * - simulation → MockExecutionProvider (instant fills, no market state needed)
 * - paper       → PaperExecutionProvider (realistic fills from Phase 9 market state)
 * - live_disabled → MockExecutionProvider (orders accepted but flagged as disabled)
 *
 * IMPORTANT: There is no live exchange provider. Adding one requires an explicit
 * ADR, a new IExecutionProvider implementation, and an environment secret.
 * The string "live" is not a valid ExecutionMode value.
 */

const mockProvider = new MockExecutionProvider();

export function getExecutionProvider(mode: ExecutionMode): IExecutionProvider {
  switch (mode) {
    case "simulation":
      return mockProvider;
    case "paper":
      return getPaperExecutionProvider();
    case "live_disabled":
      // Live mode is permanently disabled. Orders go to mock but are flagged.
      logger.warn("Execution mode live_disabled — routing to mock provider (execution is blocked at provider level)");
      return mockProvider;
    default: {
      const _exhaustive: never = mode;
      logger.error({ mode: _exhaustive }, "Unknown execution mode — defaulting to mock");
      return mockProvider;
    }
  }
}

export function getAllProviderHealthStatuses(): ProviderHealthStatus[] {
  return [
    mockProvider.getHealthStatus(),
    getPaperExecutionProvider().getHealthStatus(),
    {
      name: "binance",
      mode: "live_disabled" as ExecutionMode,
      isReady: false,
      ordersInFlight: 0,
      totalSubmitted: 0,
      totalFilled: 0,
      totalRejected: 0,
      avgAckLatencyMs: 0,
      description: "Binance live execution — not implemented (Phase 10 safe mode only)",
    },
  ];
}

export function getProviderInfo() {
  return [
    {
      name: "mock",
      description: "Instant-fill mock provider — simulation mode, no real execution",
      mode: "simulation",
      status: "available",
      requiresApiKey: false,
    },
    {
      name: "paper",
      description: "Paper trading provider — realistic fills using Phase 9 market state",
      mode: "paper",
      status: "available",
      requiresApiKey: false,
    },
    {
      name: "binance",
      description: "Binance spot/futures execution — LIVE mode permanently disabled in Phase 10",
      mode: "live_disabled",
      status: "disabled",
      requiresApiKey: true,
      note: "Live trading requires Phase 11 safety review and explicit activation",
    },
    {
      name: "forex",
      description: "Forex broker execution — stub, future phase",
      mode: "live_disabled",
      status: "stub",
      requiresApiKey: true,
    },
    {
      name: "equities",
      description: "Equities broker execution — stub, future phase",
      mode: "live_disabled",
      status: "stub",
      requiresApiKey: true,
    },
  ];
}
