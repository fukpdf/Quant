/**
 * execution-types.ts — shared TypeScript types for Phase 10 Execution Engine.
 *
 * All execution providers, the OMS, state machine, and routes reference these types.
 * No business logic here — types and interfaces only.
 *
 * SAFETY: LIVE mode is architecturally impossible without explicitly setting
 * EXECUTION_MODE=live_disabled. The string "live" is not a valid mode value.
 */

// ---------------------------------------------------------------------------
// Execution Mode (ADR-025)
// ---------------------------------------------------------------------------

/** Three supported modes. LIVE trading is permanently disabled at type level. */
export type ExecutionMode = "simulation" | "paper" | "live_disabled";

export const VALID_EXECUTION_MODES: ExecutionMode[] = ["simulation", "paper", "live_disabled"];
export const DEFAULT_EXECUTION_MODE: ExecutionMode = "simulation";

// ---------------------------------------------------------------------------
// Order Types & TIF
// ---------------------------------------------------------------------------

export type OrderType =
  | "market"
  | "limit"
  | "stop"
  | "stop_limit"
  | "reduce_only"
  | "post_only";

export type OrderSide = "buy" | "sell";

/** Time-in-force: good-till-cancelled | immediate-or-cancel | fill-or-kill */
export type TimeInForce = "gtc" | "ioc" | "fok";

// ---------------------------------------------------------------------------
// Order State Machine (ADR-026)
// ---------------------------------------------------------------------------

export type OrderStatus =
  | "created"
  | "validated"
  | "risk_approved"
  | "routed"
  | "acknowledged"
  | "partially_filled"
  | "filled"
  | "cancelled"
  | "rejected"
  | "failed"
  | "recovering";

/** Terminal states — no further transitions possible */
export const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
  "filled",
  "cancelled",
  "rejected",
  "failed",
]);

/** Active states — order is still in flight */
export const ACTIVE_ORDER_STATUSES = new Set<OrderStatus>([
  "created",
  "validated",
  "risk_approved",
  "routed",
  "acknowledged",
  "partially_filled",
  "recovering",
]);

/** Valid state transitions */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  created: ["validated", "rejected", "failed"],
  validated: ["risk_approved", "rejected", "failed"],
  risk_approved: ["routed", "rejected", "failed"],
  routed: ["acknowledged", "rejected", "failed", "recovering"],
  acknowledged: ["partially_filled", "filled", "cancelled", "rejected", "failed", "recovering"],
  partially_filled: ["partially_filled", "filled", "cancelled", "failed", "recovering"],
  filled: [],
  cancelled: [],
  rejected: [],
  failed: [],
  recovering: ["routed", "acknowledged", "filled", "cancelled", "failed"],
};

// ---------------------------------------------------------------------------
// Pre-Trade Pipeline Stages
// ---------------------------------------------------------------------------

export type ValidationStage =
  | "request"
  | "symbol"
  | "account"
  | "mode"
  | "order_type"
  | "quantity"
  | "position_limits"
  | "risk_profile"
  | "circuit_breakers"
  | "kill_switch";

export interface ValidationResult {
  passed: boolean;
  stage: ValidationStage;
  reason?: string;
  detail?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Order Request (OMS input)
// ---------------------------------------------------------------------------

export interface CreateOrderRequest {
  accountId: string;
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: string;
  limitPrice?: string;
  stopPrice?: string;
  tif?: TimeInForce;
  strategyName?: string;
  clientOrderId?: string;
  /** Force a specific execution mode (defaults to account's mode) */
  executionMode?: ExecutionMode;
}

// ---------------------------------------------------------------------------
// Provider Interface (ADR-027)
// ---------------------------------------------------------------------------

export interface ProviderOrderRequest {
  internalOrderId: string;
  symbol: string;
  orderType: OrderType;
  side: OrderSide;
  quantity: string;
  limitPrice?: string;
  stopPrice?: string;
  tif: TimeInForce;
  executionMode: ExecutionMode;
  marketPrice?: string;
}

export interface ProviderOrderResponse {
  success: boolean;
  externalOrderId?: string;
  status: "acknowledged" | "rejected" | "error";
  rejectReason?: string;
  ackLatencyMs: number;
}

export interface ProviderFillEvent {
  internalOrderId: string;
  externalOrderId?: string;
  fillPrice: string;
  fillQuantity: string;
  commission: string;
  commissionAsset: string;
  isMaker: boolean;
  exchangeFillId?: string;
  remainingQty: string;
  isComplete: boolean;
  filledAt: Date;
}

/** IExecutionProvider — pluggable execution provider interface */
export interface IExecutionProvider {
  readonly name: string;
  readonly executionMode: ExecutionMode;

  /** Submit an order to the provider. Returns ACK or rejection. */
  submitOrder(request: ProviderOrderRequest): Promise<ProviderOrderResponse>;

  /** Cancel an order at the provider level. */
  cancelOrder(internalOrderId: string, externalOrderId?: string): Promise<boolean>;

  /** Check if provider is ready to accept orders */
  isReady(): boolean;

  /** Provider health description */
  getHealthStatus(): ProviderHealthStatus;
}

export interface ProviderHealthStatus {
  name: string;
  mode: ExecutionMode;
  isReady: boolean;
  ordersInFlight: number;
  totalSubmitted: number;
  totalFilled: number;
  totalRejected: number;
  avgAckLatencyMs: number;
  description: string;
}

// ---------------------------------------------------------------------------
// Fill Engine
// ---------------------------------------------------------------------------

export interface FillResult {
  orderId: string;
  fillPrice: string;
  fillQuantity: string;
  cumulativeQty: string;
  remainingQty: string;
  commission: string;
  commissionAsset: string;
  isMaker: boolean;
  slippageBps: string;
  fillType: "full" | "partial";
  fillLatencyMs: number;
}

// ---------------------------------------------------------------------------
// Position Engine
// ---------------------------------------------------------------------------

export interface PositionUpdate {
  positionId: string;
  symbol: string;
  side: "long" | "short";
  quantity: string;
  avgEntryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  realizedPnl: string;
  status: "open" | "closed";
}

// ---------------------------------------------------------------------------
// Execution Analytics
// ---------------------------------------------------------------------------

export interface ExecutionAnalyticsSummary {
  mode: ExecutionMode;
  provider: string;
  period: string;
  totalOrders: number;
  totalFills: number;
  totalRejections: number;
  totalCancellations: number;
  fillRate: number;
  rejectRate: number;
  cancelRate: number;
  avgSlippageBps: number;
  avgFillTimeMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  successRate: number;
}

// ---------------------------------------------------------------------------
// Recovery Engine
// ---------------------------------------------------------------------------

export type RecoveryIssue =
  | "lost_ack"
  | "lost_fill"
  | "provider_timeout"
  | "duplicate_event"
  | "disconnected_session"
  | "stale_order";

export type RecoveryAction = "retry" | "reconcile" | "replay" | "repair" | "audit";

export interface RecoveryCase {
  orderId: string;
  issue: RecoveryIssue;
  action: RecoveryAction;
  detail: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export type ExecutionAuditAction =
  | "order_created"
  | "order_validated"
  | "order_risk_approved"
  | "order_risk_rejected"
  | "order_routed"
  | "order_acknowledged"
  | "order_filled"
  | "order_partially_filled"
  | "order_cancelled"
  | "order_rejected"
  | "order_failed"
  | "order_recovering"
  | "position_opened"
  | "position_closed"
  | "position_updated"
  | "session_started"
  | "session_stopped"
  | "kill_switch_activated"
  | "recovery_triggered"
  | "recovery_resolved"
  | "analytics_computed";

// ---------------------------------------------------------------------------
// Event Bus Integration (Phase 9 EventBus extended event types)
// ---------------------------------------------------------------------------

export type ExecutionEventType =
  | "OrderCreated"
  | "OrderValidated"
  | "OrderApproved"
  | "OrderRejected"
  | "OrderRouted"
  | "OrderAcknowledged"
  | "OrderFilled"
  | "OrderCancelled"
  | "OrderFailed"
  | "PositionUpdated"
  | "ExecutionRecovered";
