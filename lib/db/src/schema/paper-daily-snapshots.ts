import {
  pgTable,
  uuid,
  numeric,
  integer,
  date,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";

/**
 * Daily performance snapshots for each paper account.
 * One row per account per calendar day.
 * Used for time-series performance analytics and equity curves.
 */
export const paperDailySnapshotsTable = pgTable(
  "paper_daily_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    /** The date this snapshot represents (UTC) */
    snapshotDate: date("snapshot_date").notNull(),
    /** Total equity at end of day */
    equity: numeric("equity", { precision: 20, scale: 8 }).notNull(),
    /** Cash balance at end of day */
    cashBalance: numeric("cash_balance", { precision: 20, scale: 8 }).notNull(),
    /** Total market value of open positions */
    positionValue: numeric("position_value", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Realized PnL for the day */
    dailyRealizedPnl: numeric("daily_realized_pnl", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Unrealized PnL at end of day */
    unrealizedPnl: numeric("unrealized_pnl", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Return for the day as decimal fraction */
    dailyReturnPct: numeric("daily_return_pct", { precision: 8, scale: 6 }).notNull().default("0"),
    /** Drawdown from peak at end of day */
    drawdownPct: numeric("drawdown_pct", { precision: 8, scale: 6 }).notNull().default("0"),
    /** Number of open positions at snapshot time */
    openPositions: integer("open_positions").notNull().default(0),
    /** Number of trades closed during the day */
    tradesClosed: integer("trades_closed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("paper_daily_snapshots_account_date_uidx").on(table.accountId, table.snapshotDate),
    index("paper_daily_snapshots_account_id_idx").on(table.accountId),
    index("paper_daily_snapshots_date_idx").on(table.snapshotDate),
  ],
);

export const insertPaperDailySnapshotSchema = createInsertSchema(paperDailySnapshotsTable).omit({
  id: true,
  createdAt: true,
});

export const selectPaperDailySnapshotSchema = createSelectSchema(paperDailySnapshotsTable);

export type InsertPaperDailySnapshot = z.infer<typeof insertPaperDailySnapshotSchema>;
export type PaperDailySnapshot = typeof paperDailySnapshotsTable.$inferSelect;
