import { logger } from "../lib/logger";
import {
  createDrawdownEvent,
  createRiskEvent,
  listDrawdownEvents,
  resolveDrawdownEvent,
  appendAuditLog,
} from "./risk-db";
import { getPaperAccount } from "./paper-accounts-db";
import { getLatestPortfolioRiskSnapshot } from "./risk-db";
import { checkDrawdownBreaker } from "./circuit-breaker-service";

/**
 * Drawdown Monitor — Phase 6.
 *
 * Evaluates drawdown limits at multiple time horizons:
 *   - Daily drawdown (vs opening equity at UTC midnight)
 *   - Weekly drawdown (vs equity 7 days ago)
 *   - Account drawdown (vs peak equity all-time)
 *   - Portfolio drawdown (vs portfolio peak — same as account for single account)
 *
 * Actions triggered:
 *   drawdown_pct < warning_threshold  → no action
 *   warning_threshold ≤ dd < restriction_threshold → warning event
 *   restriction_threshold ≤ dd < halt_threshold    → restriction event
 *   dd ≥ halt_threshold                            → trading halt event
 */

const WARNING_THRESHOLD_PCT = 50;   // % of max drawdown limit
const RESTRICTION_THRESHOLD_PCT = 75;  // % of max drawdown limit
const HALT_THRESHOLD_PCT = 100;        // 100% = at the configured limit

/**
 * Monitor drawdown for a single account.
 * @param accountId - paper account ID
 * @param maxDrawdownPct - configured maximum drawdown from risk profile
 * @param maxDailyLossPct - configured maximum daily loss
 * @param maxWeeklyLossPct - configured maximum weekly loss
 */
export async function monitorAccountDrawdown(
  accountId: string,
  maxDrawdownPct: number,
  maxDailyLossPct: number,
  maxWeeklyLossPct: number,
): Promise<void> {
  const account = await getPaperAccount(accountId);
  if (!account || account.status !== "active") return;

  const snapshot = await getLatestPortfolioRiskSnapshot(accountId);
  if (!snapshot) return;

  const currentEquity = parseFloat(account.currentEquity);
  const initialCapital = parseFloat(account.initialCapital);

  // Account drawdown: % decline from peak equity (approximated by initial capital for simplicity)
  // In a real system, peak equity is tracked from the portfolios table
  const peakEquity = Math.max(currentEquity, initialCapital);
  const accountDrawdownPct = peakEquity > 0
    ? ((peakEquity - currentEquity) / peakEquity) * 100
    : 0;

  // Daily drawdown from snapshot
  const dailyDrawdownPct = parseFloat(snapshot.dailyDrawdownPct);

  // Weekly drawdown from snapshot
  const weeklyDrawdownPct = parseFloat(snapshot.weeklyDrawdownPct);

  // Check and record each drawdown type
  await checkAndRecordDrawdown({
    accountId,
    eventType: "account_drawdown",
    drawdownPct: accountDrawdownPct,
    thresholdPct: maxDrawdownPct,
  });

  await checkAndRecordDrawdown({
    accountId,
    eventType: "daily_drawdown",
    drawdownPct: dailyDrawdownPct,
    thresholdPct: maxDailyLossPct,
  });

  await checkAndRecordDrawdown({
    accountId,
    eventType: "weekly_drawdown",
    drawdownPct: weeklyDrawdownPct,
    thresholdPct: maxWeeklyLossPct,
  });

  // Also check circuit breaker for account-level drawdown
  await checkDrawdownBreaker(accountId, accountDrawdownPct);
}

async function checkAndRecordDrawdown(opts: {
  accountId: string;
  eventType: string;
  drawdownPct: number;
  thresholdPct: number;
}): Promise<void> {
  const { accountId, eventType, drawdownPct, thresholdPct } = opts;

  if (drawdownPct <= 0 || thresholdPct <= 0) return;

  const utilizationPct = (drawdownPct / thresholdPct) * 100;

  let action: "warning" | "restriction" | "halt" | null = null;
  let severity: "info" | "warning" | "critical" = "info";

  if (utilizationPct >= HALT_THRESHOLD_PCT) {
    action = "halt";
    severity = "critical";
  } else if (utilizationPct >= RESTRICTION_THRESHOLD_PCT) {
    action = "restriction";
    severity = "warning";
  } else if (utilizationPct >= WARNING_THRESHOLD_PCT) {
    action = "warning";
    severity = "info";
  }

  if (!action) return;

  // Deduplication: check if there is already an unresolved event of the same type
  const existing = await listDrawdownEvents({
    accountId,
    resolved: false,
    limit: 10,
  });

  const alreadyRecorded = existing.some((e) => e.eventType === eventType && e.action === action);
  if (alreadyRecorded) return;

  await createDrawdownEvent({
    accountId,
    eventType,
    drawdownPct: String(drawdownPct.toFixed(4)),
    thresholdPct: String(thresholdPct.toFixed(4)),
    action,
    resolved: false,
  });

  await createRiskEvent({
    accountId,
    eventType: `${eventType}_${action}`,
    severity,
    message: `${eventType.replace("_", " ")} ${action}: ${drawdownPct.toFixed(2)}% vs limit ${thresholdPct.toFixed(2)}% (${utilizationPct.toFixed(0)}% utilization)`,
    payload: { drawdownPct, thresholdPct, utilizationPct, action },
    resolved: false,
  });

  logger.warn(
    { accountId, eventType, drawdownPct, thresholdPct, action, severity },
    `Drawdown ${action} triggered`,
  );

  await appendAuditLog({
    actor: "scheduler",
    action: `drawdown.${action}.${eventType}`,
    entityType: "account",
    entityId: accountId,
    payload: { eventType, drawdownPct, thresholdPct, utilizationPct },
    result: "success",
  });
}

/**
 * Resolve all open drawdown events for an account where drawdown has recovered.
 * Called when the account equity recovers above threshold.
 */
export async function resolveRecoveredDrawdowns(
  accountId: string,
  currentDrawdownPct: number,
  thresholdPct: number,
): Promise<void> {
  if (currentDrawdownPct >= thresholdPct * (WARNING_THRESHOLD_PCT / 100)) return;

  const unresolved = await listDrawdownEvents({ accountId, resolved: false });
  for (const event of unresolved) {
    await resolveDrawdownEvent(event.id);
    logger.info({ accountId, eventId: event.id }, "Drawdown event resolved (recovery)");
  }
}
