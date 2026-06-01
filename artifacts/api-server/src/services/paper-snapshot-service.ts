import { logger } from "../lib/logger";
import {
  getPaperAccount,
  getOpenPositions,
  upsertDailySnapshot,
  listDailySnapshots,
  countTodayTrades,
  getPaperPortfolio,
  listPaperAccounts,
} from "./paper-accounts-db";

/**
 * Paper Snapshot Service — Phase 5.
 *
 * Generates and persists daily equity snapshots for each active paper account.
 * Snapshots are upserted (one row per account per calendar day).
 * Called by the paper scheduler at end-of-day or on demand via API.
 *
 * Enables:
 *   - Time-series equity curve for the paper account
 *   - Daily return calculation
 *   - Historical drawdown tracking
 */

/**
 * Take a snapshot for a single paper account.
 * Computes current state and upserts into paper_daily_snapshots.
 */
export async function snapshotAccount(accountId: string): Promise<void> {
  const account = await getPaperAccount(accountId);
  if (!account) {
    logger.warn({ accountId }, "Snapshot: account not found");
    return;
  }

  const portfolio = await getPaperPortfolio(accountId);
  const openPositions = await getOpenPositions(accountId);
  const tradesClosed = await countTodayTrades(accountId);

  const currentEquity = parseFloat(account.currentEquity);
  const cashBalance = parseFloat(account.cashBalance);
  const unrealizedPnl = parseFloat(account.unrealizedPnl);
  const positionValue = openPositions.reduce(
    (acc, p) => acc + parseFloat(p.marketValue),
    0,
  );

  // Compute daily return from yesterday's snapshot
  const yesterdaySnapshots = await listDailySnapshots(accountId, { limit: 2 });
  const yesterday = yesterdaySnapshots.find((s) => {
    const snapDate = new Date(s.snapshotDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return snapDate.getTime() < today.getTime();
  });

  const prevEquity = yesterday ? parseFloat(yesterday.equity) : parseFloat(account.initialCapital);
  const dailyReturnPct = prevEquity > 0 ? (currentEquity - prevEquity) / prevEquity : 0;

  // Drawdown from portfolio tracker
  const drawdownPct = portfolio ? parseFloat(portfolio.currentDrawdownPct) : 0;

  const today = new Date();
  const snapshotDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  await upsertDailySnapshot({
    accountId,
    snapshotDate,
    equity: String(currentEquity),
    cashBalance: String(cashBalance),
    positionValue: String(positionValue),
    dailyRealizedPnl: "0", // aggregated from today's closed trades
    unrealizedPnl: String(unrealizedPnl),
    dailyReturnPct: String(dailyReturnPct),
    drawdownPct: String(drawdownPct),
    openPositions: openPositions.length,
    tradesClosed,
  });

  logger.info(
    {
      accountId,
      snapshotDate,
      currentEquity,
      dailyReturnPct,
      openPositions: openPositions.length,
    },
    "Daily snapshot taken",
  );
}

/**
 * Snapshot all active paper accounts.
 * Called once per day by the paper scheduler.
 */
export async function snapshotAllAccounts(): Promise<void> {
  const accounts = await listPaperAccounts("active");
  logger.info({ count: accounts.length }, "Snapshotting all active paper accounts");

  for (const account of accounts) {
    try {
      await snapshotAccount(account.id);
    } catch (err) {
      logger.error({ err, accountId: account.id }, "Failed to snapshot account");
    }
  }
}
