import type {
  BacktestInput,
  BacktestOutput,
  SimulatedTrade,
  EquityCurvePoint,
  StrategyContext,
  Signal,
} from "../strategies/types";
import { logger } from "../lib/logger";
import type { CostModelConfig } from "./cost-model";
import { ZERO_COST_MODEL, computeRoundTripCost, applySlippage } from "./cost-model";
import type { PositionSizingConfig } from "./position-sizer";
import { FULL_POSITION_CONFIG, computePositionSize } from "./position-sizer";
import { stdDev } from "../strategies/indicators";

/**
 * Historical replay engine — Phase 4 upgrade.
 *
 * Rules:
 * - Candles are replayed in chronological order (oldest → newest).
 * - The strategy only sees candles up to and including the current index (no look-ahead bias).
 * - BUY signal → open position at the NEXT candle's open price (+ slippage).
 * - SELL signal → close position at the NEXT candle's open price (+ slippage).
 * - Position size is determined by the PositionSizingConfig each bar.
 * - Commission and slippage are applied per trade via the CostModelConfig.
 */

export interface BacktestEngineOptions {
  /** Phase 3 compatibility shim — overrides positionSizing.value if provided */
  positionSizeFraction?: number;
  /** Cost model to apply (defaults to zero-cost) */
  costModel?: CostModelConfig;
  /** Position sizing configuration (defaults to 100% fixed percentage) */
  positionSizing?: PositionSizingConfig;
}

/** Extended SimulatedTrade with Phase 4 cost tracking */
export interface SimulatedTradeWithCosts extends SimulatedTrade {
  /** Total commission paid for this round trip */
  commission: number;
  /** Total slippage impact in quote units */
  slippage: number;
  /** Gross P&L before costs */
  grossPnl: number;
  /** Net P&L after commission and slippage */
  netPnl: number;
}

export interface BacktestOutputExtended extends BacktestOutput {
  trades: SimulatedTradeWithCosts[];
  totalCommission: number;
  totalSlippage: number;
}

/** Internal state for an open (not yet closed) simulated position */
interface OpenTrade {
  side: "BUY";
  entryTime: Date;
  rawEntryPrice: number;
  adjustedEntryPrice: number;
  quantity: number;
  entrySignal: string;
  candleIndexEntry: number;
  entryVolume: number;
}

export async function runBacktest(
  input: BacktestInput,
  options: BacktestEngineOptions = {},
): Promise<BacktestOutputExtended> {
  const { candles, strategy, params } = input;

  // Backward-compatible: if positionSizeFraction provided, use it directly
  const positionSizing: PositionSizingConfig =
    options.positionSizeFraction !== undefined
      ? { ...FULL_POSITION_CONFIG, value: options.positionSizeFraction }
      : (options.positionSizing ?? FULL_POSITION_CONFIG);

  const costModel: CostModelConfig = options.costModel ?? ZERO_COST_MODEL;

  if (candles.length === 0) {
    return {
      trades: [],
      equityCurve: [],
      candlesProcessed: 0,
      totalCommission: 0,
      totalSlippage: 0,
    };
  }

  strategy.initialize(params);
  strategy.onStart();

  let capital = input.initialCapital;
  let inPosition = false;
  let openTrade: OpenTrade | null = null;
  let pendingSignal: Signal | null = null;

  const trades: SimulatedTradeWithCosts[] = [];
  const equityCurve: EquityCurvePoint[] = [];
  let totalCommission = 0;
  let totalSlippage = 0;

  // Running win/loss stats for Kelly sizing
  let runningWins = 0;
  let runningLosses = 0;
  let runningTotalWinPct = 0;
  let runningTotalLossPct = 0;

  equityCurve.push({ timestamp: candles[0]!.timestamp, equity: capital });

  for (let i = 0; i < candles.length; i++) {
    const currentCandle = candles[i]!;

    // -----------------------------------------------------------------------
    // Execute the PREVIOUS candle's signal at this candle's open price
    // -----------------------------------------------------------------------
    if (pendingSignal !== null) {
      const rawExecutionPrice = currentCandle.open;
      const visibleCandles = candles.slice(0, i);
      const recentCloses = visibleCandles.slice(-20).map((c) => c.close);
      const recentVolatility = recentCloses.length >= 3 ? stdDev(recentCloses) : 0;

      if (pendingSignal === "BUY" && !inPosition) {
        // Compute position size
        const currentEquity =
          capital; // capital is uninvested since we have no position
        const { quantity } = computePositionSize(
          currentEquity,
          rawExecutionPrice,
          positionSizing,
          visibleCandles,
          runningWins + runningLosses > 0 ? runningWins / (runningWins + runningLosses) : 0.5,
          runningWins > 0 ? runningTotalWinPct / runningWins : 0.02,
          runningLosses > 0 ? runningTotalLossPct / runningLosses : -0.01,
        );

        // Apply entry slippage
        const { adjustedPrice: adjustedEntryPrice } = applySlippage(
          rawExecutionPrice,
          "BUY",
          costModel,
          recentVolatility,
          rawExecutionPrice * quantity,
          currentCandle.volume,
        );

        // Commission on entry
        const entryCommission = quantity * adjustedEntryPrice * (
          costModel.commissionType === "flat"
            ? (costModel.commissionValue / (quantity * adjustedEntryPrice))
            : costModel.commissionType === "maker_taker"
            ? costModel.takerFee
            : costModel.commissionValue
        );
        capital -= entryCommission;
        totalCommission += entryCommission;
        totalSlippage += (adjustedEntryPrice - rawExecutionPrice) * quantity;

        openTrade = {
          side: "BUY",
          entryTime: currentCandle.timestamp,
          rawEntryPrice: rawExecutionPrice,
          adjustedEntryPrice,
          quantity,
          entrySignal: "BUY_SIGNAL",
          candleIndexEntry: i,
          entryVolume: currentCandle.volume,
        };
        inPosition = true;
        logger.debug(
          { i, price: adjustedEntryPrice, quantity, commission: entryCommission },
          "BT: Opened long",
        );

      } else if (pendingSignal === "SELL" && inPosition && openTrade !== null) {
        // Apply exit slippage
        const { adjustedPrice: adjustedExitPrice } = applySlippage(
          rawExecutionPrice,
          "SELL",
          costModel,
          recentVolatility,
          rawExecutionPrice * openTrade.quantity,
          currentCandle.volume,
        );

        // Commission on exit
        const exitCommission = openTrade.quantity * adjustedExitPrice * (
          costModel.commissionType === "flat"
            ? (costModel.commissionValue / (openTrade.quantity * adjustedExitPrice))
            : costModel.commissionType === "maker_taker"
            ? costModel.takerFee
            : costModel.commissionValue
        );
        totalCommission += exitCommission;
        totalSlippage += (openTrade.adjustedEntryPrice - rawExecutionPrice < 0
          ? rawExecutionPrice - adjustedExitPrice
          : openTrade.adjustedEntryPrice - rawExecutionPrice) * openTrade.quantity;

        const grossPnl =
          (adjustedExitPrice - openTrade.adjustedEntryPrice) * openTrade.quantity;
        const netPnl = grossPnl - exitCommission;
        const pnl = netPnl;
        const pnlPct =
          openTrade.adjustedEntryPrice > 0
            ? (adjustedExitPrice - openTrade.adjustedEntryPrice) /
              openTrade.adjustedEntryPrice - exitCommission / (openTrade.adjustedEntryPrice * openTrade.quantity)
            : 0;

        const closedTrade: SimulatedTradeWithCosts = {
          side: openTrade.side,
          entryTime: openTrade.entryTime,
          entryPrice: openTrade.adjustedEntryPrice,
          quantity: openTrade.quantity,
          entrySignal: openTrade.entrySignal,
          candleIndexEntry: openTrade.candleIndexEntry,
          exitTime: currentCandle.timestamp,
          exitPrice: adjustedExitPrice,
          pnl,
          pnlPct,
          exitSignal: "SELL_SIGNAL",
          candleIndexExit: i,
          commission: exitCommission,
          slippage: (rawExecutionPrice - adjustedExitPrice) * openTrade.quantity,
          grossPnl,
          netPnl,
        };
        trades.push(closedTrade);
        capital += grossPnl - exitCommission;
        inPosition = false;
        openTrade = null;

        // Update running stats for Kelly
        if (pnlPct >= 0) {
          runningWins++;
          runningTotalWinPct += pnlPct;
        } else {
          runningLosses++;
          runningTotalLossPct += pnlPct;
        }

        logger.debug(
          { i, price: adjustedExitPrice, netPnl, commission: exitCommission },
          "BT: Closed long",
        );
      }

      pendingSignal = null;
    }

    // -----------------------------------------------------------------------
    // Mark-to-market equity
    // -----------------------------------------------------------------------
    let equity = capital;
    if (inPosition && openTrade !== null) {
      equity =
        capital +
        (currentCandle.close - openTrade.adjustedEntryPrice) * openTrade.quantity;
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
    const rawExitPrice = lastCandle.close;
    const costResult = computeRoundTripCost(
      openTrade.rawEntryPrice,
      rawExitPrice,
      openTrade.quantity,
      costModel,
      0,
      openTrade.entryVolume,
      lastCandle.volume,
    );

    const grossPnl =
      (costResult.adjustedExitPrice - openTrade.adjustedEntryPrice) * openTrade.quantity;
    const exitCommission =
      openTrade.quantity * costResult.adjustedExitPrice * (
        costModel.commissionType === "flat"
          ? costModel.commissionValue / (openTrade.quantity * costResult.adjustedExitPrice)
          : costModel.commissionType === "maker_taker"
          ? costModel.takerFee
          : costModel.commissionValue
      );
    const netPnl = grossPnl - exitCommission;
    const pnl = netPnl;
    const pnlPct =
      openTrade.adjustedEntryPrice > 0
        ? (costResult.adjustedExitPrice - openTrade.adjustedEntryPrice) /
          openTrade.adjustedEntryPrice
        : 0;

    trades.push({
      side: openTrade.side,
      entryTime: openTrade.entryTime,
      entryPrice: openTrade.adjustedEntryPrice,
      quantity: openTrade.quantity,
      entrySignal: openTrade.entrySignal,
      candleIndexEntry: openTrade.candleIndexEntry,
      exitTime: lastCandle.timestamp,
      exitPrice: costResult.adjustedExitPrice,
      pnl,
      pnlPct,
      exitSignal: "END_OF_BACKTEST",
      candleIndexExit: candles.length - 1,
      commission: exitCommission,
      slippage: costResult.totalSlippage,
      grossPnl,
      netPnl,
    });
    capital += grossPnl - exitCommission;
    totalCommission += exitCommission;
    totalSlippage += costResult.totalSlippage;
  }

  strategy.onFinish();

  return { trades, equityCurve, candlesProcessed: candles.length, totalCommission, totalSlippage };
}
