import type {
  BacktestInput,
  BacktestOutput,
  SimulatedTrade,
  EquityCurvePoint,
  StrategyContext,
  Signal,
} from "../strategies/types";
import { logger } from "../lib/logger";

/**
 * Historical replay engine.
 *
 * Rules:
 * - Candles are replayed in chronological order (oldest → newest).
 * - The strategy only sees candles up to and including the current index (no look-ahead bias).
 * - Simple long-only, one-position-at-a-time model:
 *     BUY signal → open position at the NEXT candle's open price.
 *     SELL signal → close position at the NEXT candle's open price.
 * - Fixed fractional position sizing (default 100% of available capital).
 * - No commissions or slippage modelled in Phase 3 (Phase 4 adds cost models).
 */

export interface BacktestEngineOptions {
  positionSizeFraction?: number;
}

/** Internal state for an open (not yet closed) simulated position */
interface OpenTrade {
  side: "BUY";
  entryTime: Date;
  entryPrice: number;
  quantity: number;
  entrySignal: string;
  candleIndexEntry: number;
}

export async function runBacktest(
  input: BacktestInput,
  options: BacktestEngineOptions = {},
): Promise<BacktestOutput> {
  const { candles, strategy, params } = input;
  const positionSizeFraction = options.positionSizeFraction ?? 1.0;

  if (candles.length === 0) {
    return { trades: [], equityCurve: [], candlesProcessed: 0 };
  }

  strategy.initialize(params);
  strategy.onStart();

  let capital = input.initialCapital;
  let inPosition = false;
  let openTrade: OpenTrade | null = null;
  let pendingSignal: Signal | null = null;

  const trades: SimulatedTrade[] = [];
  const equityCurve: EquityCurvePoint[] = [];

  equityCurve.push({ timestamp: candles[0]!.timestamp, equity: capital });

  for (let i = 0; i < candles.length; i++) {
    const currentCandle = candles[i]!;

    // -----------------------------------------------------------------------
    // Execute the PREVIOUS candle's signal at this candle's open price
    // -----------------------------------------------------------------------
    if (pendingSignal !== null) {
      const executionPrice = currentCandle.open;

      if (pendingSignal === "BUY" && !inPosition) {
        const quantity = (capital * positionSizeFraction) / executionPrice;
        openTrade = {
          side: "BUY",
          entryTime: currentCandle.timestamp,
          entryPrice: executionPrice,
          quantity,
          entrySignal: "BUY_SIGNAL",
          candleIndexEntry: i,
        };
        inPosition = true;
        logger.debug({ i, price: executionPrice, quantity }, "BT: Opened long");

      } else if (pendingSignal === "SELL" && inPosition && openTrade !== null) {
        const pnl = (executionPrice - openTrade.entryPrice) * openTrade.quantity;
        const pnlPct = (executionPrice - openTrade.entryPrice) / openTrade.entryPrice;
        const closedTrade: SimulatedTrade = {
          side: openTrade.side,
          entryTime: openTrade.entryTime,
          entryPrice: openTrade.entryPrice,
          quantity: openTrade.quantity,
          entrySignal: openTrade.entrySignal,
          candleIndexEntry: openTrade.candleIndexEntry,
          exitTime: currentCandle.timestamp,
          exitPrice: executionPrice,
          pnl,
          pnlPct,
          exitSignal: "SELL_SIGNAL",
          candleIndexExit: i,
        };
        trades.push(closedTrade);
        capital += pnl;
        inPosition = false;
        openTrade = null;
        logger.debug({ i, price: executionPrice, pnl }, "BT: Closed long");
      }

      pendingSignal = null;
    }

    // -----------------------------------------------------------------------
    // Mark-to-market equity
    // -----------------------------------------------------------------------
    let equity = capital;
    if (inPosition && openTrade !== null) {
      equity = capital + (currentCandle.close - openTrade.entryPrice) * openTrade.quantity;
    }
    equityCurve.push({ timestamp: currentCandle.timestamp, equity });

    // -----------------------------------------------------------------------
    // Ask the strategy for a signal — only candles[0..i] are visible
    // -----------------------------------------------------------------------
    const ctx: StrategyContext = {
      candles: candles.slice(0, i + 1),
      currentIndex: i,
      currentCandle,
      inPosition,
    };

    const signal = strategy.generateSignal(ctx);
    if (signal !== "HOLD") {
      pendingSignal = signal;
    }
  }

  // -------------------------------------------------------------------------
  // Force-close any open position at the final candle's close
  // -------------------------------------------------------------------------
  if (inPosition && openTrade !== null && candles.length > 0) {
    const lastCandle = candles[candles.length - 1]!;
    const exitPrice = lastCandle.close;
    const pnl = (exitPrice - openTrade.entryPrice) * openTrade.quantity;
    const pnlPct = (exitPrice - openTrade.entryPrice) / openTrade.entryPrice;
    trades.push({
      side: openTrade.side,
      entryTime: openTrade.entryTime,
      entryPrice: openTrade.entryPrice,
      quantity: openTrade.quantity,
      entrySignal: openTrade.entrySignal,
      candleIndexEntry: openTrade.candleIndexEntry,
      exitTime: lastCandle.timestamp,
      exitPrice,
      pnl,
      pnlPct,
      exitSignal: "END_OF_BACKTEST",
      candleIndexExit: candles.length - 1,
    });
    capital += pnl;
  }

  strategy.onFinish();

  return { trades, equityCurve, candlesProcessed: candles.length };
}
