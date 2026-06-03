import { logger } from "../lib/logger";
import type {
  IExecutionProvider,
  ExecutionMode,
  ProviderOrderRequest,
  ProviderOrderResponse,
  ProviderHealthStatus,
} from "./execution-types";
import { getMarketState } from "./market-state-engine";

/**
 * paper-execution-provider.ts — Paper trading execution provider (ADR-027).
 *
 * Uses Phase 9 MarketStateEngine for realistic fill simulation:
 * - Market orders: fill at current bid/ask with configurable slippage
 * - Limit orders: ACK immediately; fill when price crosses limit (checked at ACK)
 * - Stop orders: ACK immediately; fill when stop is triggered
 *
 * Commission: 0.1% (10 bps) taker, 0.05% (5 bps) maker
 *
 * This provider does NOT connect to any broker. It is 100% simulated.
 */

const TAKER_COMMISSION_RATE = 0.001; // 0.1%
const MAKER_COMMISSION_RATE = 0.0005; // 0.05%
const SLIPPAGE_BPS = 5; // 5 bps slippage on market orders

export class PaperExecutionProvider implements IExecutionProvider {
  readonly name = "paper";
  readonly executionMode: ExecutionMode = "paper";

  private ordersInFlight = 0;
  private totalSubmitted = 0;
  private totalFilled = 0;
  private totalRejected = 0;
  private ackLatencies: number[] = [];

  async submitOrder(request: ProviderOrderRequest): Promise<ProviderOrderResponse> {
    const start = Date.now();
    this.ordersInFlight++;
    this.totalSubmitted++;

    try {
      // Attempt to get live market state from Phase 9 stream engine
      const marketState = getMarketState(request.symbol);

      if (!marketState) {
        // No live price available — check if this is acceptable
        if (request.orderType === "market") {
          // Market orders require a live price
          this.ordersInFlight--;
          this.totalRejected++;
          return {
            success: false,
            status: "rejected",
            rejectReason: `No market price available for ${request.symbol}`,
            ackLatencyMs: Date.now() - start,
          };
        }
        // Limit/stop orders can be acknowledged without a live price
      }

      // Market order fill price simulation
      if (request.orderType === "market" && marketState) {
        const basePrice = request.side === "buy"
          ? parseFloat(marketState.askPrice || String(marketState.lastPrice))
          : parseFloat(marketState.bidPrice || String(marketState.lastPrice));

        // Apply slippage (adverse)
        const slippageFactor = request.side === "buy"
          ? 1 + SLIPPAGE_BPS / 10000
          : 1 - SLIPPAGE_BPS / 10000;

        const fillPrice = (basePrice * slippageFactor).toFixed(8);

        logger.debug(
          { orderId: request.internalOrderId, symbol: request.symbol, fillPrice },
          "PaperExecutionProvider: market order priced",
        );
      }

      // Simulate 5ms ACK latency (realistic paper trading)
      await new Promise((resolve) => setTimeout(resolve, 5));

      this.ordersInFlight--;
      this.totalFilled++;

      const ackLatencyMs = Date.now() - start;
      this.ackLatencies.push(ackLatencyMs);
      if (this.ackLatencies.length > 200) this.ackLatencies.shift();

      return {
        success: true,
        externalOrderId: `PAPER-${request.internalOrderId.slice(0, 8).toUpperCase()}`,
        status: "acknowledged",
        ackLatencyMs,
      };
    } catch (err) {
      this.ordersInFlight--;
      this.totalRejected++;
      logger.error({ err, orderId: request.internalOrderId }, "PaperExecutionProvider: submit error");
      return {
        success: false,
        status: "error",
        rejectReason: "Provider internal error",
        ackLatencyMs: Date.now() - start,
      };
    }
  }

  cancelOrder(internalOrderId: string): Promise<boolean> {
    logger.debug({ orderId: internalOrderId }, "PaperExecutionProvider: order cancelled");
    return Promise.resolve(true);
  }

  isReady(): boolean {
    return true;
  }

  /**
   * Compute fill price for a paper order.
   * Called by the fill engine after provider ACK.
   */
  computeFillPrice(request: ProviderOrderRequest): string {
    const marketState = getMarketState(request.symbol);
    const fallbackPrice = request.limitPrice ?? request.marketPrice ?? "0";

    if (!marketState) return fallbackPrice;

    if (request.orderType === "market") {
      const base = request.side === "buy"
        ? parseFloat(marketState.askPrice || String(marketState.lastPrice))
        : parseFloat(marketState.bidPrice || String(marketState.lastPrice));
      const slipFactor = request.side === "buy" ? 1 + SLIPPAGE_BPS / 10000 : 1 - SLIPPAGE_BPS / 10000;
      return (base * slipFactor).toFixed(8);
    }

    // Limit/stop: fill at limit price (best case)
    return request.limitPrice ?? String(marketState.lastPrice);
  }

  computeCommission(fillPrice: string, quantity: string, isMaker: boolean): string {
    const price = parseFloat(fillPrice);
    const qty = parseFloat(quantity);
    const rate = isMaker ? MAKER_COMMISSION_RATE : TAKER_COMMISSION_RATE;
    return (price * qty * rate).toFixed(8);
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
      description: "Paper trading provider — realistic fill simulation using live market state",
    };
  }
}

// Singleton
let instance: PaperExecutionProvider | null = null;
export function getPaperExecutionProvider(): PaperExecutionProvider {
  if (!instance) instance = new PaperExecutionProvider();
  return instance;
}
