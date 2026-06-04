import { logger } from "../lib/logger";

/**
 * webhook-provider.ts — HTTP webhook delivery for alert notifications.
 *
 * Supports:
 *  - Generic webhooks: POST with JSON payload
 *  - Slack-compatible webhooks: Slack Block Kit format
 *
 * Retry logic is handled by the notification engine; this provider
 * performs a single delivery attempt and returns success/failure.
 */

export interface WebhookPayload {
  alertRuleName: string;
  severity: "warning" | "critical" | "emergency";
  message: string;
  triggeredAt: string;
  details?: Record<string, unknown>;
}

export interface WebhookResult {
  success: boolean;
  statusCode?: number;
  responseBody?: string;
  errorDetail?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Generic webhook delivery
// ---------------------------------------------------------------------------

export async function deliverWebhook(
  url: string,
  payload: WebhookPayload,
  headers?: Record<string, string>,
): Promise<WebhookResult> {
  const startedAt = Date.now();

  try {
    const body = JSON.stringify({
      event: "quantforge.alert",
      alert: payload.alertRuleName,
      severity: payload.severity,
      message: payload.message,
      triggeredAt: payload.triggeredAt,
      details: payload.details ?? {},
    });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "QuantForge/1.0",
        ...headers,
      },
      body,
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const responseBody = await response.text().catch(() => "");
    const durationMs = Date.now() - startedAt;
    const success = response.ok;

    logger.info(
      { url: url.slice(0, 50), statusCode: response.status, durationMs, success },
      "Webhook delivered",
    );

    return { success, statusCode: response.status, responseBody, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorDetail = err instanceof Error ? err.message : String(err);
    logger.warn({ url: url.slice(0, 50), errorDetail, durationMs }, "Webhook delivery failed");
    return { success: false, errorDetail, durationMs };
  }
}

// ---------------------------------------------------------------------------
// Slack-compatible webhook (Block Kit format)
// ---------------------------------------------------------------------------

export async function deliverSlackWebhook(
  webhookUrl: string,
  payload: WebhookPayload,
): Promise<WebhookResult> {
  const startedAt = Date.now();

  const severityEmoji: Record<string, string> = {
    warning: "⚠️",
    critical: "🔴",
    emergency: "🚨",
  };

  const slackBody = JSON.stringify({
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severityEmoji[payload.severity] ?? "🔔"} QuantForge Alert: ${payload.alertRuleName}`,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Severity:*\n${payload.severity.toUpperCase()}` },
          { type: "mrkdwn", text: `*Time:*\n${new Date(payload.triggeredAt).toLocaleString()}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Message:*\n${payload.message}` },
      },
    ],
    text: `QuantForge Alert [${payload.severity.toUpperCase()}]: ${payload.alertRuleName} — ${payload.message}`,
  });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "QuantForge/1.0" },
      body: slackBody,
      signal: AbortSignal.timeout(10000),
    });

    const responseBody = await response.text().catch(() => "");
    const durationMs = Date.now() - startedAt;
    const success = response.ok;

    logger.info(
      { statusCode: response.status, durationMs, success },
      "Slack webhook delivered",
    );

    return { success, statusCode: response.status, responseBody, durationMs };
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const errorDetail = err instanceof Error ? err.message : String(err);
    logger.warn({ errorDetail, durationMs }, "Slack webhook delivery failed");
    return { success: false, errorDetail, durationMs };
  }
}
