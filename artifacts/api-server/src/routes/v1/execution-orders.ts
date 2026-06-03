import { Router } from "express";
import { z } from "zod/v4";
import { submitOrder, cancelOrder } from "../../services/execution-oms";
import { getExecutionOrder, listExecutionOrders, getOrderEvents } from "../../services/execution-db";
import { upsertDefaultExecutionAccount } from "../../services/execution-db";
import { DEFAULT_EXECUTION_MODE } from "../../services/execution-types";

/**
 * execution-orders.ts — OMS order submission and management endpoints.
 *
 * POST /v1/execution/orders          — submit new order
 * GET  /v1/execution/orders          — list orders with filters
 * GET  /v1/execution/orders/:id      — get order detail + events
 * POST /v1/execution/orders/:id/cancel — cancel active order
 */

const router = Router();

const CreateOrderSchema = z.object({
  accountId: z.string().uuid().optional(),
  symbol: z.string().min(3).max(20),
  orderType: z.enum(["market", "limit", "stop", "stop_limit", "reduce_only", "post_only"]),
  side: z.enum(["buy", "sell"]),
  quantity: z.string().refine((v) => parseFloat(v) > 0, { error: "quantity must be positive" }),
  limitPrice: z.string().optional(),
  stopPrice: z.string().optional(),
  tif: z.enum(["gtc", "ioc", "fok"]).optional().default("gtc"),
  strategyName: z.string().max(100).optional(),
  clientOrderId: z.string().max(100).optional(),
  executionMode: z.enum(["simulation", "paper", "live_disabled"]).optional(),
});

// POST /v1/execution/orders
router.post("/execution/orders", async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  const data = parsed.data;

  // If no accountId provided, use/create the default account for the mode
  let accountId = data.accountId;
  if (!accountId) {
    const mode = data.executionMode ?? DEFAULT_EXECUTION_MODE;
    try {
      accountId = await upsertDefaultExecutionAccount(mode);
    } catch (err) {
      req.log?.error({ err }, "Failed to resolve default execution account");
      return res.status(500).json({ error: "Failed to resolve execution account" });
    }
  }

  try {
    const result = await submitOrder({ ...data, accountId });
    const statusCode = result.status === "rejected" || result.status === "failed" ? 422 : 201;
    return res.status(statusCode).json({ data: result });
  } catch (err) {
    req.log?.error({ err }, "OMS: order submission failed");
    return res.status(500).json({ error: "Order submission failed" });
  }
});

// GET /v1/execution/orders
router.get("/execution/orders", async (req, res) => {
  const { accountId, status, symbol, mode, limit = "50", offset = "0" } = req.query as Record<string, string>;

  try {
    const orders = await listExecutionOrders({
      accountId,
      status: status ? (status.includes(",") ? status.split(",") : status) : undefined,
      symbol,
      mode,
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
    });

    return res.json({ data: orders, count: orders.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list execution orders");
    return res.status(500).json({ error: "Failed to list orders" });
  }
});

// GET /v1/execution/orders/:id
router.get("/execution/orders/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const order = await getExecutionOrder(id);
    if (!order) {
      return res.status(404).json({ error: `Order not found: ${id}` });
    }

    const events = await getOrderEvents(id);
    return res.json({ data: { ...order, events } });
  } catch (err) {
    req.log?.error({ err, orderId: id }, "Failed to get execution order");
    return res.status(500).json({ error: "Failed to get order" });
  }
});

// POST /v1/execution/orders/:id/cancel
router.post("/execution/orders/:id/cancel", async (req, res) => {
  const { id } = req.params;

  try {
    const cancelled = await cancelOrder(id, "user");
    if (!cancelled) {
      return res.status(409).json({ error: "Order cannot be cancelled — not in a cancellable state or not found" });
    }
    return res.json({ data: { orderId: id, status: "cancelled", cancelledBy: "user" } });
  } catch (err) {
    req.log?.error({ err, orderId: id }, "Failed to cancel execution order");
    return res.status(500).json({ error: "Failed to cancel order" });
  }
});

export default router;
