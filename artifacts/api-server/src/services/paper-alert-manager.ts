import { logger } from "../lib/logger";
import { createPaperAlert, getPaperAccount, getPaperPortfolio } from "./paper-accounts-db";

/**
 * Paper Alert Manager — Phase 5.
 *
 * Generates system alerts based on account and position state.
 * Alert storage is in the paper_alerts table. No email/SMS yet.
 *
 * Alert types:
 *   large_drawdown          — drawdown exceeds configured threshold
 *   strategy_failure        — a strategy assignment produced an error
 *   position_concentration  — single position exceeds concentration limit
 *   equity_threshold        — equity drops below configured threshold
 *   missed_data             — live price data unavailable for a symbol
 *   execution_failure       — paper execution engine failed to fill an order
 */

export interface AlertThresholds {
  maxDrawdownPct: number;       // e.g. 0.10 = alert if drawdown > 10%
  minEquity: number;            // alert if equity falls below this
  maxPositionConcentrationPct: number; // e.g. 0.40 = alert if position > 40% of portfolio
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  maxDrawdownPct: 0.10,
  minEquity: 1000,
  maxPositionConcentrationPct: 0.40,
};

/**
 * Run all alert checks for a given account.
 * Generates and persists any triggered alerts.
 */
export async function runAlertChecks(
  accountId: string,
  thresholds: AlertThresholds = DEFAULT_THRESHOLDS,
): Promise<void> {
  const account = await getPaperAccount(accountId);
  if (!account || account.status !== "active") return;

  const portfolio = await getPaperPortfolio(accountId);
  if (!portfolio) return;

  const currentEquity = parseFloat(account.currentEquity);
  const currentDrawdown = parseFloat(portfolio.currentDrawdownPct);
  const allocationPct = parseFloat(portfolio.allocationPct);

  // Check: large drawdown
  if (currentDrawdown > thresholds.maxDrawdownPct) {
    await emitAlert(accountId, {
      alertType: "large_drawdown",
      severity: currentDrawdown > 0.20 ? "critical" : "warning",
      message: `Account drawdown of ${(currentDrawdown * 100).toFixed(2)}% exceeds threshold of ${(thresholds.maxDrawdownPct * 100).toFixed(0)}%`,
      payload: JSON.stringify({
        currentDrawdownPct: currentDrawdown,
        thresholdPct: thresholds.maxDrawdownPct,
        currentEquity,
      }),
    });
  }

  // Check: equity threshold
  if (currentEquity < thresholds.minEquity) {
    await emitAlert(accountId, {
      alertType: "equity_threshold",
      severity: "critical",
      message: `Account equity (${currentEquity.toFixed(2)}) has fallen below minimum threshold (${thresholds.minEquity})`,
      payload: JSON.stringify({ currentEquity, minEquity: thresholds.minEquity }),
    });
  }

  // Check: position concentration
  if (allocationPct > thresholds.maxPositionConcentrationPct) {
    await emitAlert(accountId, {
      alertType: "position_concentration",
      severity: "warning",
      message: `Portfolio allocation of ${(allocationPct * 100).toFixed(2)}% exceeds concentration limit of ${(thresholds.maxPositionConcentrationPct * 100).toFixed(0)}%`,
      payload: JSON.stringify({
        allocationPct,
        limitPct: thresholds.maxPositionConcentrationPct,
      }),
    });
  }
}

/**
 * Emit a strategy failure alert.
 * Called by the signal engine when a strategy throws an unexpected error.
 */
export async function alertStrategyFailure(
  accountId: string,
  strategyName: string,
  symbol: string,
  error: string,
): Promise<void> {
  await emitAlert(accountId, {
    alertType: "strategy_failure",
    severity: "critical",
    message: `Strategy "${strategyName}" failed on ${symbol}: ${error}`,
    payload: JSON.stringify({ strategyName, symbol, error }),
  });
}

/**
 * Emit a missed data alert (no live price available for a symbol).
 */
export async function alertMissedData(
  accountId: string | undefined,
  symbol: string,
  detail: string,
): Promise<void> {
  await emitAlert(accountId, {
    alertType: "missed_data",
    severity: "warning",
    message: `No live data for ${symbol}: ${detail}`,
    payload: JSON.stringify({ symbol, detail }),
  });
}

/**
 * Emit an execution failure alert.
 * Called by the order engine when the execution engine rejects an order.
 */
export async function alertExecutionFailure(
  accountId: string,
  symbol: string,
  orderId: string,
  reason: string,
): Promise<void> {
  await emitAlert(accountId, {
    alertType: "execution_failure",
    severity: "warning",
    message: `Order execution failed for ${symbol}: ${reason}`,
    payload: JSON.stringify({ orderId, symbol, reason }),
  });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AlertPayload {
  alertType: string;
  severity: "info" | "warning" | "critical";
  message: string;
  payload?: string;
}

async function emitAlert(
  accountId: string | undefined,
  data: AlertPayload,
): Promise<void> {
  try {
    await createPaperAlert({
      accountId: accountId ?? null,
      alertType: data.alertType,
      severity: data.severity,
      message: data.message,
      payload: data.payload ?? null,
      acknowledged: false,
      acknowledgedAt: null,
    });

    logger.warn(
      { accountId, alertType: data.alertType, severity: data.severity },
      `Paper alert: ${data.message}`,
    );
  } catch (err) {
    logger.error({ err, accountId, alertType: data.alertType }, "Failed to persist paper alert");
  }
}
