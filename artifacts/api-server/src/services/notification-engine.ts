import { db } from "@workspace/db";
import {
  notificationChannelsTable,
  notificationDeliveriesTable,
  type NotificationChannel,
  type InsertNotificationDelivery,
} from "@workspace/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { deliverWebhook, deliverSlackWebhook, type WebhookPayload } from "./webhook-provider";

/**
 * notification-engine.ts — Alert notification delivery infrastructure.
 *
 * Receives alert events and fans out to all active notification channels that
 * match the alert severity. Implements retry logic with configurable max retries,
 * cooldown enforcement, and delivery history tracking.
 *
 * Supported channels:
 *  - email: via email-provider.ts (console or SMTP)
 *  - webhook: generic HTTP POST
 *  - slack: Slack-compatible Block Kit webhook
 */

// ---------------------------------------------------------------------------
// Channel management
// ---------------------------------------------------------------------------

export async function listNotificationChannels(): Promise<NotificationChannel[]> {
  return db.select().from(notificationChannelsTable).orderBy(desc(notificationChannelsTable.createdAt));
}

export async function getNotificationChannel(id: string): Promise<NotificationChannel | null> {
  const rows = await db
    .select()
    .from(notificationChannelsTable)
    .where(eq(notificationChannelsTable.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function createNotificationChannel(data: {
  name: string;
  channelType: "email" | "webhook" | "slack";
  destination: string;
  severityFilter?: string;
  maxRetries?: number;
  cooldownSeconds?: number;
  config?: Record<string, unknown>;
}): Promise<NotificationChannel> {
  const [channel] = await db.insert(notificationChannelsTable).values({
    name: data.name,
    channelType: data.channelType,
    destination: data.destination,
    severityFilter: data.severityFilter ?? "critical,emergency",
    maxRetries: data.maxRetries ?? 3,
    cooldownSeconds: data.cooldownSeconds ?? 300,
    config: data.config ?? null,
    isActive: true,
  }).returning();

  if (!channel) throw new Error("Failed to create notification channel");
  logger.info({ channelId: channel.id, type: channel.channelType, name: channel.name }, "Notification channel created");
  return channel;
}

export async function deleteNotificationChannel(id: string): Promise<void> {
  await db.delete(notificationChannelsTable).where(eq(notificationChannelsTable.id, id));
  logger.info({ channelId: id }, "Notification channel deleted");
}

export async function setChannelActive(id: string, isActive: boolean): Promise<void> {
  await db.update(notificationChannelsTable).set({ isActive, updatedAt: new Date() }).where(eq(notificationChannelsTable.id, id));
}

// ---------------------------------------------------------------------------
// Alert delivery
// ---------------------------------------------------------------------------

export interface AlertNotification {
  alertEventId?: string;
  alertRuleName: string;
  severity: "warning" | "critical" | "emergency";
  message: string;
  triggeredAt: Date;
  details?: Record<string, unknown>;
}

export async function notifyAlert(alert: AlertNotification): Promise<void> {
  const activeChannels = await db
    .select()
    .from(notificationChannelsTable)
    .where(eq(notificationChannelsTable.isActive, true));

  const eligibleChannels = activeChannels.filter(ch => {
    const filters = (ch.severityFilter ?? "").split(",").map(s => s.trim());
    return filters.includes(alert.severity);
  });

  if (eligibleChannels.length === 0) {
    logger.debug({ severity: alert.severity }, "No eligible notification channels for alert");
    return;
  }

  logger.info(
    { alertRuleName: alert.alertRuleName, severity: alert.severity, channelCount: eligibleChannels.length },
    "Delivering alert notifications",
  );

  await Promise.allSettled(
    eligibleChannels.map(channel => deliverToChannel(channel, alert)),
  );
}

// ---------------------------------------------------------------------------
// Channel delivery with retry
// ---------------------------------------------------------------------------

async function deliverToChannel(channel: NotificationChannel, alert: AlertNotification): Promise<void> {
  // Cooldown check — skip if last success was within cooldown window
  if (channel.lastSuccessAt && channel.cooldownSeconds) {
    const cooldownMs = channel.cooldownSeconds * 1000;
    const sinceLastSuccess = Date.now() - channel.lastSuccessAt.getTime();
    if (sinceLastSuccess < cooldownMs) {
      logger.debug(
        { channelId: channel.id, remainingCooldownMs: cooldownMs - sinceLastSuccess },
        "Notification channel in cooldown — skipping",
      );
      await recordDelivery(channel, alert, 1, true, { success: false, errorDetail: "cooldown", durationMs: 0 });
      return;
    }
  }

  const maxRetries = channel.maxRetries ?? 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = await attemptDelivery(channel, alert);
    const isFinal = result.success || attempt === maxRetries;

    await recordDelivery(channel, alert, attempt, isFinal, result);

    if (result.success) {
      // Update channel success stats
      await db.update(notificationChannelsTable).set({
        successCount: (channel.successCount ?? 0) + 1,
        lastSuccessAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(notificationChannelsTable.id, channel.id));
      return;
    }

    if (!isFinal) {
      // Exponential backoff between retries
      const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 30000);
      await sleep(backoffMs);
    }
  }

  // All retries exhausted — update failure stats
  await db.update(notificationChannelsTable).set({
    failureCount: (channel.failureCount ?? 0) + 1,
    lastFailureAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(notificationChannelsTable.id, channel.id));

  logger.warn(
    { channelId: channel.id, channelName: channel.name, alertRuleName: alert.alertRuleName },
    "Notification delivery failed after all retries",
  );
}

async function attemptDelivery(
  channel: NotificationChannel,
  alert: AlertNotification,
): Promise<{ success: boolean; statusCode?: number; responseBody?: string; errorDetail?: string; durationMs: number }> {
  const payload: WebhookPayload = {
    alertRuleName: alert.alertRuleName,
    severity: alert.severity,
    message: alert.message,
    triggeredAt: alert.triggeredAt.toISOString(),
    details: alert.details,
  };

  switch (channel.channelType) {
    case "email": {
      const startedAt = Date.now();
      try {
        const { getEmailProvider } = await import("./email-provider");
        const emailProvider = getEmailProvider();
        await emailProvider.send({
          to: channel.destination,
          subject: `[QuantForge ${alert.severity.toUpperCase()}] ${alert.alertRuleName}`,
          textBody: `Alert: ${alert.alertRuleName}\nSeverity: ${alert.severity}\nMessage: ${alert.message}\nTime: ${alert.triggeredAt.toISOString()}`,
          htmlBody: `<h2>QuantForge Alert</h2><p><strong>Rule:</strong> ${alert.alertRuleName}</p><p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p><p><strong>Message:</strong> ${alert.message}</p><p><strong>Time:</strong> ${alert.triggeredAt.toISOString()}</p>`,
        });
        return { success: true, durationMs: Date.now() - startedAt };
      } catch (err) {
        return { success: false, errorDetail: err instanceof Error ? err.message : String(err), durationMs: Date.now() - startedAt };
      }
    }

    case "slack":
      return deliverSlackWebhook(channel.destination, payload);

    case "webhook":
    default: {
      const extraHeaders = (channel.config as Record<string, unknown> | null)?.headers as Record<string, string> | undefined;
      return deliverWebhook(channel.destination, payload, extraHeaders);
    }
  }
}

async function recordDelivery(
  channel: NotificationChannel,
  alert: AlertNotification,
  attemptNumber: number,
  isFinal: boolean,
  result: { success: boolean; statusCode?: number; responseBody?: string; errorDetail?: string; durationMs: number },
): Promise<void> {
  const status = result.errorDetail === "cooldown" ? "skipped" : result.success ? "delivered" : (isFinal ? "failed" : "delivering");

  try {
    await db.insert(notificationDeliveriesTable).values({
      channelId: channel.id,
      alertEventId: alert.alertEventId ?? null,
      alertRuleName: alert.alertRuleName,
      severity: alert.severity,
      status,
      attemptNumber,
      isFinal,
      responseCode: result.statusCode ?? null,
      responseBody: result.responseBody ?? null,
      durationMs: result.durationMs,
      payload: { alert: alert.alertRuleName, severity: alert.severity, message: alert.message },
      errorDetail: result.errorDetail ?? null,
      attemptedAt: new Date(),
    } satisfies InsertNotificationDelivery);
  } catch (err) {
    logger.error({ err }, "Failed to record notification delivery");
  }
}

// ---------------------------------------------------------------------------
// Delivery history
// ---------------------------------------------------------------------------

export async function listNotificationDeliveries(
  channelId?: string,
  limit = 100,
): Promise<typeof notificationDeliveriesTable.$inferSelect[]> {
  const conditions = channelId ? [eq(notificationDeliveriesTable.channelId, channelId)] : [];
  return db
    .select()
    .from(notificationDeliveriesTable)
    .where(and(...conditions))
    .orderBy(desc(notificationDeliveriesTable.createdAt))
    .limit(limit);
}

export async function getDeliveryStats(since?: Date): Promise<{
  total: number;
  delivered: number;
  failed: number;
  skipped: number;
  successRate: number;
}> {
  const conditions = since ? [gte(notificationDeliveriesTable.createdAt, since)] : [];
  const rows = await db
    .select()
    .from(notificationDeliveriesTable)
    .where(and(...conditions, eq(notificationDeliveriesTable.isFinal, true)));

  const total = rows.length;
  const delivered = rows.filter(r => r.status === "delivered").length;
  const failed = rows.filter(r => r.status === "failed").length;
  const skipped = rows.filter(r => r.status === "skipped").length;

  return {
    total,
    delivered,
    failed,
    skipped,
    successRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
