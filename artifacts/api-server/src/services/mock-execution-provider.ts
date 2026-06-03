import { logger } from "../lib/logger";
import type {
  IExecutionProvider,
  ExecutionMode,
  ProviderOrderRequest,
  ProviderOrderResponse,
  ProviderHealthStatus,
} from "./execution-types";

/**
 * mock-execution-provider.ts — Instant fill mock provider (ADR-027).
 *
 * Instant ACK + fill for every order. No market state required.
 * Used in simulation mode. Fills at requested price or a small random walk.
 *
 * Rejection simulation: orders with clientOrderId containing "reject" are rejected.
 */
export class MockExecutionProvider implements IExecutionProvider {
  readonly name = "mock";
  readonly executionMode: ExecutionMode = "simulation";

  private ordersInFlight = 0;
  private totalSubmitted = 0;
  private totalFilled = 0;
  private totalRejected = 0;
  private ackLatencies: number[] = [];

  submitOrder(request: ProviderOrderRequest): Promise<ProviderOrderResponse> {
    const start = Date.now();
    this.ordersInFlight++;
    this.totalSubmitted++;

    // Simulate forced rejection for testing
    if (request.internalOrderId.includes("reject")) {
      this.ordersInFlight--;
      this.totalRejected++;
      return Promise.resolve({
        success: false,
        status: "rejected",
        rejectReason: "Forced rejection (test)",
        ackLatencyMs: Date.now() - start,
      });
    }

    // Simulate ~2ms ACK latency
    return new Promise((resolve) => {
      setTimeout(() => {
        this.ordersInFlight--;
        this.totalFilled++;

        const latency = Date.now() - start;
        this.ackLatencies.push(latency);
        if (this.ackLatencies.length > 200) this.ackLatencies.shift();

        logger.debug(
          { orderId: request.internalOrderId, symbol: request.symbol, side: request.side },
          "MockExecutionProvider: order acknowledged",
        );

        resolve({
          success: true,
          externalOrderId: `MOCK-${request.internalOrderId.slice(0, 8).toUpperCase()}`,
          status: "acknowledged",
          ackLatencyMs: latency,
        });
      }, 2);
    });
  }

  cancelOrder(internalOrderId: string): Promise<boolean> {
    logger.debug({ orderId: internalOrderId }, "MockExecutionProvider: order cancelled");
    return Promise.resolve(true);
  }

  isReady(): boolean {
    return true;
  }

  getHealthStatus(): ProviderHealthStatus {
    const avg =
      this.ackLatencies.length > 0
        ? this.ackLatencies.reduce((a, b) => a + b, 0) / this.ackLatencies.length
        : 0;

    return {
      name: this.name,
      mode: this.executionMode,
      isReady: true,
      ordersInFlight: this.ordersInFlight,
      totalSubmitted: this.totalSubmitted,
      totalFilled: this.totalFilled,
      totalRejected: this.totalRejected,
      avgAckLatencyMs: Math.round(avg * 100) / 100,
      description: "Instant-fill mock provider — simulation mode, no real execution",
    };
  }
}
