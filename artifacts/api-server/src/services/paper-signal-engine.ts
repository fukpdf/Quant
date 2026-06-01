import { logger } from "../lib/logger";
import { createStrategy, resolveParams } from "../strategies/registry";
import type { OhlcvCandle, StrategyContext } from "../strategies/types";
import { queryCandles } from "./market-data";
import { executeOrder } from "./paper-execution-engine";
import {
  openPaperPosition,
  closePaperPosition,
  findOpenPosition,
} from "./paper-position-manager";
import {
  createPaperOrder,
  updatePaperOrder,
  createPaperFill,
  createPaperExecution,
  getPaperAccount,
} from "./paper-accounts-db";
import { refreshPortfolio } from "./paper-portfolio-tracker";
import { markToMarket } from "./paper-position-manager";
import { alertStrategyFailure, alertMissedData, alertExecutionFailure } from "./paper-alert-manager";
import { evaluateOrder as evaluateRiskOrder } from "./risk-engine";
import type { PaperStrategyAssignment } from "@workspace/db";

/**
 * Paper Signal Engine — Phase 5.
 *
 * Connects Phase 3/4 research strategies to paper trading accounts.
 * For each active strategy assignment:
 *   1. Loads recent candles for the assigned symbol/interval.
 *   2. Runs the strategy's generateSignal() on the latest candle.
 *   3. If a signal is generated, creates a simulated order.
 *   4. Passes the order to the execution engine for fill simulation.
 *   5. Updates positions, fills, and account state accordingly.
 *
 * No real broker. No real capital. Simulation only.
 */

/** How many candles to load as context for indicator warm-up */
const CANDLE_LOOKBACK = 200;

/**
 * Process a single active strategy assignment.
 * Called by the paper scheduler on each tick.
 */
export async function processAssignment(assignment: PaperStrategyAssignment): Promise<void> {
  const { id: assignmentId, accountId, strategyName, symbol, interval } = assignment;

  const account = await getPaperAccount(accountId);
  if (!account || account.status !== "active") {
    logger.debug({ assignmentId, accountId }, "Skipping assignment — account not active");
    return;
  }

  // ------------------------------------------------------------------
  // 1. Load recent candles
  // ------------------------------------------------------------------
  let candles: OhlcvCandle[];
  try {
    const rawCandles = await queryCandles({
      symbol: symbol.toUpperCase(),
      interval,
      limit: CANDLE_LOOKBACK,
    });

    if (rawCandles.length < 10) {
      await alertMissedData(
        accountId,
        symbol,
        `Only ${rawCandles.length} candles available (need at least 10)`,
      );
      return;
    }

    candles = rawCandles
      .map((c) => ({
        timestamp: c.timestamp instanceof Date ? c.timestamp : new Date(String(c.timestamp)),
        open: parseFloat(String(c.open)),
        high: parseFloat(String(c.high)),
        low: parseFloat(String(c.low)),
        close: parseFloat(String(c.close)),
        volume: parseFloat(String(c.volume)),
      }))
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertMissedData(accountId, symbol, message);
    return;
  }

  // ------------------------------------------------------------------
  // 2. Generate signal
  // ------------------------------------------------------------------
  let signal: "BUY" | "SELL" | "HOLD";
  try {
    const strategy = createStrategy(strategyName);
    const params = assignment.params ? JSON.parse(assignment.params) : {};
    const resolvedParams = resolveParams(strategy, params);
    strategy.initialize(resolvedParams);
    strategy.onStart();

    const currentIndex = candles.length - 1;
    const ctx: StrategyContext = {
      candles,
      currentIndex,
      currentCandle: candles[currentIndex]!,
      inPosition: !!(await findOpenPosition(accountId, symbol, strategyName)),
    };

    signal = strategy.generateSignal(ctx);
    strategy.onFinish();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, assignmentId, strategyName, symbol }, "Strategy signal generation failed");
    await alertStrategyFailure(accountId, strategyName, symbol, message);
    return;
  }

  logger.debug(
    { assignmentId, strategyName, symbol, interval, signal },
    "Signal generated",
  );

  if (signal === "HOLD") return;

  // ------------------------------------------------------------------
  // 3. Check existing position
  // ------------------------------------------------------------------
  const existingPosition = await findOpenPosition(accountId, symbol, strategyName);
  const latestCandle = candles[candles.length - 1]!;
  const marketPrice = latestCandle.close;

  // Compute recent volatility for slippage
  const recentCloses = candles.slice(-20).map((c) => c.close);
  const meanClose = recentCloses.reduce((a, b) => a + b, 0) / recentCloses.length;
  const recentVolatility = Math.sqrt(
    recentCloses.reduce((a, c) => a + Math.pow(c - meanClose, 2), 0) / recentCloses.length,
  );

  // ------------------------------------------------------------------
  // 4. Handle BUY signal — open a long position if not already in one
  // ------------------------------------------------------------------
  if (signal === "BUY" && !existingPosition) {
    // Create order
    const order = await createPaperOrder({
      accountId,
      strategyName,
      symbol,
      orderType: "market",
      side: "buy",
      quantity: "0", // will be sized below
      status: "pending",
      signal: "BUY_SIGNAL",
      marketPriceAtOrder: String(marketPrice),
    });

    await updatePaperOrder(order.id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    // Size the position: use 10% of available cash per trade (simple default)
    const currentCash = parseFloat(account.cashBalance);
    const tradeNotional = currentCash * 0.10;
    const quantity = tradeNotional / marketPrice;

    if (quantity <= 0 || tradeNotional < 1) {
      await updatePaperOrder(order.id, {
        status: "rejected",
        rejectReason: "Insufficient buying power",
      });
      await alertExecutionFailure(accountId, symbol, order.id, "Insufficient buying power");
      return;
    }

    // ------------------------------------------------------------------
    // Phase 6 — Pre-trade risk engine check (MANDATORY)
    // No order may reach execution without risk approval.
    // ------------------------------------------------------------------
    const latestCandleTs = latestCandle.timestamp instanceof Date
      ? latestCandle.timestamp
      : new Date(latestCandle.timestamp);
    const dataAgeMinutes = (Date.now() - latestCandleTs.getTime()) / 60_000;

    const riskDecision = await evaluateRiskOrder({
      accountId,
      strategyName,
      strategyAssignmentId: assignmentId,
      symbol,
      side: "buy",
      quantity,
      notional: tradeNotional,
      dataAgeMinutes,
    });

    if (riskDecision.decision === "rejected") {
      await updatePaperOrder(order.id, {
        status: "rejected",
        rejectReason: `Risk engine: ${riskDecision.reason}`,
      });
      logger.info(
        { accountId, strategyName, symbol, reason: riskDecision.reason },
        "Phase 6 risk engine rejected BUY order — not executing",
      );
      return;
    }

    // Execute the order
    const execResult = executeOrder({
      side: "buy",
      symbol,
      quantity,
      orderType: "market",
      marketPrice,
      recentVolume: latestCandle.volume,
      recentVolatility,
    });

    // Persist execution record
    await createPaperExecution({
      orderId: order.id,
      accountId,
      symbol,
      success: execResult.success,
      failureReason: execResult.failureReason ?? null,
      marketPrice: String(marketPrice),
      executedPrice: execResult.success ? String(execResult.executedPrice) : null,
      executedQuantity: execResult.success ? String(execResult.filledQuantity) : null,
      commission: String(execResult.commission),
      slippage: String(execResult.slippage),
      latencyMs: String(execResult.latencyMs),
    });

    if (!execResult.success) {
      await updatePaperOrder(order.id, {
        status: "rejected",
        rejectReason: execResult.failureReason ?? "Execution failed",
      });
      await alertExecutionFailure(
        accountId,
        symbol,
        order.id,
        execResult.failureReason ?? "Execution failed",
      );
      return;
    }

    // Update order to filled
    await updatePaperOrder(order.id, {
      status: "filled",
      filledQuantity: String(execResult.filledQuantity),
      avgFillPrice: String(execResult.executedPrice),
      filledAt: new Date(),
    });

    // Record fill
    await createPaperFill({
      orderId: order.id,
      accountId,
      symbol,
      side: "buy",
      quantity: String(execResult.filledQuantity),
      rawPrice: String(execResult.rawPrice),
      fillPrice: String(execResult.executedPrice),
      commission: String(execResult.commission),
      slippage: String(execResult.slippage),
      latencyMs: String(execResult.latencyMs),
    });

    // Open position
    try {
      await openPaperPosition({
        accountId,
        strategyName,
        symbol,
        side: "long",
        quantity: execResult.filledQuantity,
        fillPrice: execResult.executedPrice,
        commission: execResult.commission,
        slippage: execResult.slippage,
      });

      logger.info(
        { accountId, strategyName, symbol, quantity: execResult.filledQuantity, price: execResult.executedPrice },
        "Paper BUY executed",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, accountId, symbol }, "Failed to open paper position");
      await alertExecutionFailure(accountId, symbol, order.id, message);
    }
  }

  // ------------------------------------------------------------------
  // 5. Handle SELL signal — close existing long position
  // ------------------------------------------------------------------
  if (signal === "SELL" && existingPosition) {
    const order = await createPaperOrder({
      accountId,
      strategyName,
      symbol,
      orderType: "market",
      side: "sell",
      quantity: existingPosition.quantity,
      status: "pending",
      signal: "SELL_SIGNAL",
      marketPriceAtOrder: String(marketPrice),
    });

    await updatePaperOrder(order.id, {
      status: "submitted",
      submittedAt: new Date(),
    });

    const qty = parseFloat(existingPosition.quantity);
    const sellNotional = qty * marketPrice;

    // ------------------------------------------------------------------
    // Phase 6 — Pre-trade risk engine check for SELL (MANDATORY)
    // ------------------------------------------------------------------
    const latestCandleTsSell = latestCandle.timestamp instanceof Date
      ? latestCandle.timestamp
      : new Date(latestCandle.timestamp);
    const dataAgeMinutesSell = (Date.now() - latestCandleTsSell.getTime()) / 60_000;

    const riskDecisionSell = await evaluateRiskOrder({
      accountId,
      strategyName,
      strategyAssignmentId: assignmentId,
      symbol,
      side: "sell",
      quantity: qty,
      notional: sellNotional,
      dataAgeMinutes: dataAgeMinutesSell,
    });

    if (riskDecisionSell.decision === "rejected") {
      await updatePaperOrder(order.id, {
        status: "rejected",
        rejectReason: `Risk engine: ${riskDecisionSell.reason}`,
      });
      logger.info(
        { accountId, strategyName, symbol, reason: riskDecisionSell.reason },
        "Phase 6 risk engine rejected SELL order — not executing",
      );
      return;
    }

    const execResult = executeOrder({
      side: "sell",
      symbol,
      quantity: qty,
      orderType: "market",
      marketPrice,
      recentVolume: latestCandle.volume,
      recentVolatility,
    });

    await createPaperExecution({
      orderId: order.id,
      accountId,
      symbol,
      success: execResult.success,
      failureReason: execResult.failureReason ?? null,
      marketPrice: String(marketPrice),
      executedPrice: execResult.success ? String(execResult.executedPrice) : null,
      executedQuantity: execResult.success ? String(execResult.filledQuantity) : null,
      commission: String(execResult.commission),
      slippage: String(execResult.slippage),
      latencyMs: String(execResult.latencyMs),
    });

    if (!execResult.success) {
      await updatePaperOrder(order.id, {
        status: "rejected",
        rejectReason: execResult.failureReason ?? "Execution failed",
      });
      await alertExecutionFailure(
        accountId,
        symbol,
        order.id,
        execResult.failureReason ?? "Execution failed",
      );
      return;
    }

    await updatePaperOrder(order.id, {
      status: "filled",
      filledQuantity: String(execResult.filledQuantity),
      avgFillPrice: String(execResult.executedPrice),
      filledAt: new Date(),
    });

    await createPaperFill({
      orderId: order.id,
      accountId,
      symbol,
      side: "sell",
      quantity: String(execResult.filledQuantity),
      rawPrice: String(execResult.rawPrice),
      fillPrice: String(execResult.executedPrice),
      commission: String(execResult.commission),
      slippage: String(execResult.slippage),
      latencyMs: String(execResult.latencyMs),
    });

    try {
      await closePaperPosition({
        positionId: existingPosition.id,
        accountId,
        exitPrice: execResult.executedPrice,
        commission: execResult.commission,
        slippage: execResult.slippage,
        exitSignal: "SELL_SIGNAL",
      });

      logger.info(
        { accountId, strategyName, symbol, price: execResult.executedPrice },
        "Paper SELL executed",
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, accountId, symbol }, "Failed to close paper position");
      await alertExecutionFailure(accountId, symbol, order.id, message);
    }
  }

  // ------------------------------------------------------------------
  // 6. Refresh portfolio after any trade
  // ------------------------------------------------------------------
  const prices: Record<string, number> = { [symbol]: marketPrice };
  await markToMarket({ accountId, prices });
  await refreshPortfolio(accountId);
}

/**
 * Retrieve live price for mark-to-market from the candles table.
 * Returns the close of the latest candle for the symbol.
 */
export async function getLivePrice(symbol: string, interval = "1h"): Promise<number | null> {
  try {
    const candles = await queryCandles({
      symbol: symbol.toUpperCase(),
      interval,
      limit: 1,
    });
    const latest = candles[candles.length - 1];
    return latest ? parseFloat(String(latest.close)) : null;
  } catch {
    return null;
  }
}
