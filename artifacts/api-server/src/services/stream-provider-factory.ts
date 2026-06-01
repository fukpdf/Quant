import { logger } from "../lib/logger";
import { MockStreamProvider } from "./stream-providers/mock-stream-provider";
import { BinanceWebSocketProvider } from "./stream-providers/binance-websocket-provider";
import type { IStreamProvider, StreamProviderName } from "./stream-types";

/**
 * StreamProviderFactory — env-driven provider selection.
 *
 * Reads STREAM_PROVIDER env var. Falls back to "mock" if unset or unrecognized.
 * Pattern mirrors AiProviderFactory (ADR-018) for consistency.
 */
export class StreamProviderFactory {
  private static instance: IStreamProvider | null = null;

  static getProvider(): IStreamProvider {
    if (this.instance) return this.instance;

    const raw = (process.env["STREAM_PROVIDER"] ?? "mock").toLowerCase() as StreamProviderName;

    let provider: IStreamProvider;

    switch (raw) {
      case "binance":
        provider = new BinanceWebSocketProvider();
        logger.info({ provider: "binance" }, "Stream provider: Binance WebSocket");
        break;

      case "mock":
      default:
        if (raw !== "mock") {
          logger.warn(
            { requested: raw },
            "Unknown STREAM_PROVIDER — falling back to mock",
          );
        }
        provider = new MockStreamProvider();
        logger.info({ provider: "mock" }, "Stream provider: Mock (synthetic data)");
        break;
    }

    this.instance = provider;
    return provider;
  }

  /** Reset singleton — used in tests and provider switching */
  static reset(): void {
    this.instance = null;
  }

  static getProviderName(): StreamProviderName {
    const raw = (process.env["STREAM_PROVIDER"] ?? "mock").toLowerCase();
    return (["binance", "mock", "forex", "equities", "crypto"].includes(raw)
      ? raw
      : "mock") as StreamProviderName;
  }
}
