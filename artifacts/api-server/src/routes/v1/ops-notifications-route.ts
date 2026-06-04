import { Router, type IRouter } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import {
  listNotificationChannels,
  getNotificationChannel,
  createNotificationChannel,
  deleteNotificationChannel,
  setChannelActive,
  listNotificationDeliveries,
  getDeliveryStats,
} from "../../services/notification-engine";

const router: IRouter = Router();

/**
 * GET /api/v1/ops/notification-channels
 * List all notification channels with 24-hour delivery stats.
 */
router.get("/ops/notification-channels", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const [channels, stats] = await Promise.all([
      listNotificationChannels(),
      getDeliveryStats(new Date(Date.now() - 24 * 3600 * 1000)),
    ]);
    res.json({ channels, deliveryStats24h: stats });
  } catch (err) {
    req.log.error({ err }, "Failed to list notification channels");
    res.status(500).json({ error: "Failed to list notification channels" });
  }
});

/**
 * POST /api/v1/ops/notification-channels
 * Create a new notification channel.
 */
router.post("/ops/notification-channels", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    const { name, channelType, destination, severityFilter, maxRetries, cooldownSeconds, config } = req.body as {
      name?: string;
      channelType?: string;
      destination?: string;
      severityFilter?: string;
      maxRetries?: number;
      cooldownSeconds?: number;
      config?: Record<string, unknown>;
    };

    if (!name || !channelType || !destination) {
      return res.status(400).json({ error: "name, channelType, and destination are required" });
    }

    const validTypes = ["email", "webhook", "slack"] as const;
    if (!validTypes.includes(channelType as typeof validTypes[number])) {
      return res.status(400).json({ error: "channelType must be: email | webhook | slack" });
    }

    const channel = await createNotificationChannel({
      name,
      channelType: channelType as "email" | "webhook" | "slack",
      destination,
      severityFilter,
      maxRetries,
      cooldownSeconds,
      config,
    });

    return res.status(201).json(channel);
  } catch (err) {
    req.log.error({ err }, "Failed to create notification channel");
    return res.status(500).json({ error: "Failed to create notification channel" });
  }
});

/**
 * GET /api/v1/ops/notification-channels/:id
 * Get a specific channel with its delivery history.
 */
router.get("/ops/notification-channels/:id", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const channel = await getNotificationChannel(id);
    if (!channel) return res.status(404).json({ error: "Notification channel not found" });

    const deliveries = await listNotificationDeliveries(id, 50);
    return res.json({ channel, deliveries });
  } catch (err) {
    req.log.error({ err }, "Failed to get notification channel");
    return res.status(500).json({ error: "Failed to get notification channel" });
  }
});

/**
 * PATCH /api/v1/ops/notification-channels/:id/toggle
 * Enable or disable a notification channel.
 */
router.patch("/ops/notification-channels/:id/toggle", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const channel = await getNotificationChannel(id);
    if (!channel) return res.status(404).json({ error: "Notification channel not found" });

    await setChannelActive(id, !channel.isActive);
    return res.json({ success: true, isActive: !channel.isActive });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle notification channel");
    return res.status(500).json({ error: "Failed to toggle notification channel" });
  }
});

/**
 * DELETE /api/v1/ops/notification-channels/:id
 * Delete a notification channel.
 */
router.delete("/ops/notification-channels/:id", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const channel = await getNotificationChannel(id);
    if (!channel) return res.status(404).json({ error: "Notification channel not found" });

    await deleteNotificationChannel(id);
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete notification channel");
    return res.status(500).json({ error: "Failed to delete notification channel" });
  }
});

/**
 * GET /api/v1/ops/notification-deliveries
 * List notification delivery history with optional channel filter.
 */
router.get("/ops/notification-deliveries", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const channelId = req.query["channelId"] as string | undefined;
    const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
    const [deliveries, stats] = await Promise.all([
      listNotificationDeliveries(channelId, limit),
      getDeliveryStats(),
    ]);
    res.json({ deliveries, stats });
  } catch (err) {
    req.log.error({ err }, "Failed to list notification deliveries");
    res.status(500).json({ error: "Failed to list notification deliveries" });
  }
});

export default router;
