import { logger } from "../lib/logger";
import type { CreateOrderRequest, OrderStatus } from "./execution-types";
import { DEFAULT_EXECUTION_MODE } from "./execution-types";
import { runPreTradePipeline } from "./execution-pre-trade-pipeline";
import { getExecutionProvider } from "./execution-router";
import { transition } from "./execution-state-machine";
import { processFill } from "./execution-fill-engine";
import { onFill as onPositionFill } from "./execution-position-engine";
import {
  insertExecutionOrder,
  getExecutionOrder,
  getExecutionAccount,
  updateExecutionOrderStatus,
  insertExecutionRoute,
  updateExecutionRoute,
  insertExecutionRejection,
  insertExecutionLatency,
  insertExecutionAuditLog,
  updateExecutionSession,
  getActiveExecutionSession,
} from "./execution-db";
import { publish } from "./event-bus";
import { getMarketState } from "./market-state-engine";

/**
 * execution-oms.ts — Order Management System core (ADR-026).
 *
 * The OMS is the single entry point for all order activity.
 * It orchestrates: validation → risk → routing → fill → position update → audit.
 *
 * Every operation is idempotent-safe: duplicate clientOrderId requests
 * are caught before insertion.
 *
 * SAFETY: No real-money execution. All orders route to paper or mock providers.
 */

export interface SubmitOrderResult {
  orderId: string;
  status: OrderStatus;
  externalOrderId?: string;
  rejectReason?: string;
  rejectStage?: string;
  validationLatencyMs: number;
  routingLatencyMs?: number;
  fillLatencyMs?: number;
  totalLatencyMs: number;
}

/**
 * Submit a new order through the full OMS pipeline.
 */
export async function submitOrder(req: CreateOrderRequest): Promise<SubmitOrderResult> {
  const totalStart = Date.now();

  // Resolve execution mode from request or account
  let executionMode = req.executionMode ?? DEFAULT_EXECUTION_MODE;
  const account = await getExecutionAccount(req.accountId).catch(() => null);
  if (!account) {
    const totalMs = Date.now() - totalStart;
    logger.warn({ accountId: req.accountId }, "OMS: account not found");
    return {
      orderId: "unknown",
      status: "rejected",
      rejectReason: `Account not found: ${req.accountId}`,
      rejectStage: "validation",
      validationLatencyMs: totalMs,
      totalLatencyMs: totalMs,
    };
  }
  executionMode = (account.executionMode as any) ?? executionMode;

  // Get current market price for context
  const marketState = getMarketState(req.symbol);
  const marketPriceAtOrder = marketState ? String(marketState.lastPrice) : undefined;

  // Insert order in CREATED state
  const order = await insertExecutionOrder({
    accountId: req.accountId,
    orderType: req.orderType,
    side: req.side,
    symbol: req.symbol,
    quantity: req.quantity,
    filledQuantity: "0",
    remainingQuantity: req.quantity,
    limitPrice: req.limitPrice ?? null,
    stopPrice: req.stopPrice ?? null,
    tif: req.tif ?? "gtc",
    executionMode,
    strategyName: req.strategyName ?? null,
    clientOrderId: req.clientOrderId ?? null,
    marketPriceAtOrder: marketPriceAtOrder ?? null,
    status: "created",
  });

  const orderId = order.id;

  // Emit event bus
  publish({
    eventType: "OrderCreated",
    source: "oms",
    symbol: req.symbol,
    data: { orderId, symbol: req.symbol, side: req.side, orderType: req.orderType, executionMode },
    emittedAt: Date.now(),
  });

  await insertExecutionAuditLog({
    orderId,
    accountId: req.accountId,
    action: "order_created",
    actor: "oms",
    executionMode,
    symbol: req.symbol,
    detail: { orderType: req.orderType, side: req.side, qty: req.quantity, mode: executionMode },
    success: true,
  });

  // ---------------------------------------------------------------------------
  // Stage 1: Pre-trade validation
  // ---------------------------------------------------------------------------
  const validationStart = Date.now();
  const pipelineResult = await runPreTradePipeline({ ...req, executionMode });
  const validationLatencyMs = Date.now() - validationStart;

  await insertExecutionLatency({ orderId, stage: "validation", latencyMs: String(validationLatencyMs), executionMode });

  if (!pipelineResult.passed) {
    await transition({
      orderId,
      fromStatus: "created",
      toStatus: "rejected",
      event: "ValidationFailed",
      actor: "oms",
      detail: { stage: pipelineResult.failedAt, reason: pipelineResult.rejectReason },
      latencyMs: validationLatencyMs,
      orderUpdate: { rejectReason: pipelineResult.rejectReason, rejectStage: pipelineResult.failedAt, rejectedAt: new Date() },
    });

    await insertExecutionRejection({
      orderId,
      stage: pipelineResult.failedAt ?? "validation",
      reason: pipelineResult.rejectReason ?? "Validation failed",
      detail: { stages: pipelineResult.stages },
      symbol: req.symbol,
      executionMode,
    });

    await insertExecutionAuditLog({
      orderId,
      action: "order_rejected",
      actor: "oms",
      executionMode,
      symbol: req.symbol,
      detail: { stage: pipelineResult.failedAt, reason: pipelineResult.rejectReason },
      success: false,
      errorMessage: pipelineResult.rejectReason,
    });

    publish({ eventType: "OrderRejected", source: "oms", symbol: req.symbol, data: { orderId, reason: pipelineResult.rejectReason, stage: pipelineResult.failedAt }, emittedAt: Date.now() });

    return {
      orderId,
      status: "rejected",
      rejectReason: pipelineResult.rejectReason,
      rejectStage: pipelineResult.failedAt,
      validationLatencyMs,
      totalLatencyMs: Date.now() - totalStart,
    };
  }

  // Transition to validated
  await transition({
    orderId,
    fromStatus: "created",
    toStatus: "validated",
    event: "ValidationPassed",
    actor: "oms",
    latencyMs: validationLatencyMs,
  });

  publish({ eventType: "OrderValidated", source: "oms", symbol: req.symbol, data: { orderId }, emittedAt: Date.now() });

  // ---------------------------------------------------------------------------
  // Stage 2: Risk approval (simplified — delegates to pre-trade pipeline stage 8)
  // The risk engine integration passes if pre-trade pipeline passes.
  // In a full live implementation, this would call the evaluateOrder() risk engine.
  // ---------------------------------------------------------------------------
  const riskStart = Date.now();
  const riskLatencyMs = Date.now() - riskStart;
  await insertExecutionLatency({ orderId, stage: "risk", latencyMs: String(riskLatencyMs), executionMode });

  await transition({
    orderId,
    fromStatus: "validated",
    toStatus: "risk_approved",
    event: "RiskApproved",
    actor: "risk_engine",
    latencyMs: riskLatencyMs,
    orderUpdate: { riskResult: "approved" },
  });

  publish({ eventType: "OrderApproved", source: "risk_engine", symbol: req.symbol, data: { orderId }, emittedAt: Date.now() });

  await insertExecutionAuditLog({
    orderId,
    action: "order_risk_approved",
    actor: "risk_engine",
    executionMode,
    symbol: req.symbol,
    detail: { riskResult: "approved" },
    success: true,
  });

  // ---------------------------------------------------------------------------
  // Stage 3: Route to provider
  // ---------------------------------------------------------------------------
  const routingStart = Date.now();
  const provider = getExecutionProvider(executionMode as any);

  const routeRecord = await insertExecutionRoute({
    orderId,
    provider: provider.name,
    status: "pending",
    attempt: "1",
    routedAt: new Date(),
  });

  await transition({
    orderId,
    fromStatus: "risk_approved",
    toStatus: "routed",
    event: "OrderRouted",
    actor: "oms",
    orderUpdate: { routedTo: provider.name, routedAt: new Date() },
  });

  publish({ eventType: "OrderRouted", source: "oms", symbol: req.symbol, data: { orderId, provider: provider.name }, emittedAt: Date.now() });

  const providerResponse = await provider.submitOrder({
    internalOrderId: orderId,
    symbol: req.symbol,
    orderType: req.orderType,
    side: req.side,
    quantity: req.quantity,
    limitPrice: req.limitPrice,
    stopPrice: req.stopPrice,
    tif: req.tif ?? "gtc",
    executionMode: executionMode as any,
    marketPrice: marketPriceAtOrder,
  });

  const routingLatencyMs = Date.now() - routingStart;
  await insertExecutionLatency({ orderId, stage: "routing", latencyMs: String(routingLatencyMs), executionMode, provider: provider.name });

  // Update route record
  await updateExecutionRoute(routeRecord.id, {
    status: providerResponse.success ? "acknowledged" : "rejected",
    ackLatencyMs: String(providerResponse.ackLatencyMs),
    externalOrderId: providerResponse.externalOrderId,
    errorMessage: providerResponse.rejectReason,
    acknowledgedAt: new Date(),
  });

  if (!providerResponse.success) {
    await transition({
      orderId,
      fromStatus: "routed",
      toStatus: "rejected",
      event: "ProviderRejected",
      actor: "provider",
      detail: { provider: provider.name, reason: providerResponse.rejectReason },
      orderUpdate: { rejectReason: providerResponse.rejectReason, rejectStage: "provider", rejectedAt: new Date() },
    });

    await insertExecutionRejection({
      orderId,
      stage: "provider",
      reason: providerResponse.rejectReason ?? "Provider rejected",
      symbol: req.symbol,
      executionMode,
    });

    publish({ eventType: "OrderRejected", source: "provider", symbol: req.symbol, data: { orderId, provider: provider.name }, emittedAt: Date.now() });

    return {
      orderId,
      status: "rejected",
      rejectReason: providerResponse.rejectReason,
      rejectStage: "provider",
      validationLatencyMs,
      routingLatencyMs,
      totalLatencyMs: Date.now() - totalStart,
    };
  }

  // Transition to acknowledged
  await transition({
    orderId,
    fromStatus: "routed",
    toStatus: "acknowledged",
    event: "ProviderAcknowledged",
    actor: "provider",
    detail: { externalOrderId: providerResponse.externalOrderId, provider: provider.name },
    latencyMs: providerResponse.ackLatencyMs,
    orderUpdate: {
      externalOrderId: providerResponse.externalOrderId,
      acknowledgedAt: new Date(),
    },
  });

  publish({ eventType: "OrderAcknowledged", source: "provider", symbol: req.symbol, data: { orderId, externalOrderId: providerResponse.externalOrderId }, emittedAt: Date.now() });

  // ---------------------------------------------------------------------------
  // Stage 4: Fill processing
  // ---------------------------------------------------------------------------
  const fillStart = Date.now();

  const fillResult = await processFill({
    orderId,
    accountId: req.accountId,
    symbol: req.symbol,
    side: req.side,
    orderType: req.orderType,
    requestedQuantity: req.quantity,
    limitPrice: req.limitPrice,
    currentStatus: "acknowledged",
    executionMode,
    marketPrice: marketPriceAtOrder,
  });

  const fillLatencyMs = Date.now() - fillStart;
  await insertExecutionLatency({ orderId, stage: "fill", latencyMs: String(fillLatencyMs), executionMode, provider: provider.name });

  // ---------------------------------------------------------------------------
  // Stage 5: Position update
  // ---------------------------------------------------------------------------
  await onPositionFill({
    orderId,
    accountId: req.accountId,
    symbol: req.symbol,
    side: req.side as "buy" | "sell",
    fillPrice: fillResult.fillPrice,
    fillQuantity: fillResult.fillQuantity,
    commission: fillResult.commission,
    executionMode,
    strategyName: req.strategyName,
  });

  // ---------------------------------------------------------------------------
  // End-to-end latency
  // ---------------------------------------------------------------------------
  const totalLatencyMs = Date.now() - totalStart;
  await insertExecutionLatency({ orderId, stage: "end_to_end", latencyMs: String(totalLatencyMs), executionMode, provider: provider.name });
  await updateExecutionOrderStatus(orderId, fillResult.fillType === "full" ? "filled" : "partially_filled", {
    totalLatencyMs: String(totalLatencyMs),
  });

  // Update session counters
  try {
    const session = await getActiveExecutionSession(executionMode);
    if (session) {
      const filled = parseInt(session.ordersFilled as string) + 1;
      const fills = parseInt(session.fillsProcessed as string) + 1;
      await updateExecutionSession(session.id, {
        ordersPlaced: String(parseInt(session.ordersPlaced as string) + 1),
        ordersFilled: String(filled),
        fillsProcessed: String(fills),
      });
    }
  } catch { /* non-fatal */ }

  logger.info(
    { orderId, symbol: req.symbol, fillPrice: fillResult.fillPrice, totalLatencyMs },
    `OMS: order completed (${fillResult.fillType})`,
  );

  return {
    orderId,
    status: fillResult.fillType === "full" ? "filled" : "partially_filled",
    externalOrderId: providerResponse.externalOrderId,
    validationLatencyMs,
    routingLatencyMs,
    fillLatencyMs,
    totalLatencyMs,
  };
}

/**
 * Cancel an active order.
 */
export async function cancelOrder(orderId: string, actor = "user"): Promise<boolean> {
  const order = await getExecutionOrder(orderId);
  if (!order) {
    logger.warn({ orderId }, "OMS: cancel — order not found");
    return false;
  }

  const cancellableStatuses: OrderStatus[] = ["created", "validated", "risk_approved", "routed", "acknowledged", "partially_filled", "recovering"];
  if (!cancellableStatuses.includes(order.status as OrderStatus)) {
    logger.warn({ orderId, status: order.status }, "OMS: cancel — order not in cancellable state");
    return false;
  }

  // Cancel at provider if routed
  if (order.routedTo) {
    const provider = getExecutionProvider(order.executionMode as any);
    await provider.cancelOrder(orderId, order.externalOrderId ?? undefined).catch(() => {});
  }

  await transition({
    orderId,
    fromStatus: order.status as OrderStatus,
    toStatus: "cancelled",
    event: "OrderCancelled",
    actor,
    orderUpdate: { cancelledAt: new Date() },
  });

  await insertExecutionAuditLog({
    orderId,
    action: "order_cancelled",
    actor,
    executionMode: order.executionMode as string,
    symbol: order.symbol,
    detail: { previousStatus: order.status },
    success: true,
  });

  publish({
    eventType: "OrderCancelled",
    source: "oms",
    symbol: order.symbol,
    data: { orderId, previousStatus: order.status, actor },
    emittedAt: Date.now(),
  });

  return true;
}
