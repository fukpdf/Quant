import {
  pgTable,
  uuid,
  numeric,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";

/**
 * Current portfolio state for each paper account.
 * Tracks aggregate exposure, allocation, and drawdown.
 * One row per account (upserted on each portfolio update cycle).
 */
export const paperPortfoliosTable = pgTable(
  "paper_portfolios",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => paperAccountsTable.id),
    /** Total number of open positions */
    openPositions: integer("open_positions").notNull().default(0),
    /** Total number of closed positions (all time) */
    closedPositions: integer("closed_positions").notNull().default(0),
    /** Total market value of all open positions */
    totalExposure: numeric("total_exposure", { precision: 20, scale: 8 }).notNull().default("0"),
    /** Exposure as fraction of total equity */
    allocationPct: numeric("allocation_pct", { precision: 8, scale: 6 }).notNull().default("0"),
    /** Total equity at peak since account inception (for drawdown calc) */
    peakEquity: numeric("peak_equity", { precision: 20, scale: 8 }).notNull(),
    /** Current drawdown from peak as decimal fraction */
    currentDrawdownPct: numeric("current_drawdown_pct", { precision: 8, scale: 6 }).notNull().default("0"),
    /** Max drawdown ever recorded as decimal fraction */
    maxDrawdownPct: numeric("max_drawdown_pct", { precision: 8, scale: 6 }).notNull().default("0"),
    /** Return since last daily snapshot */
    dailyReturnPct: numeric("daily_return_pct", { precision: 8, scale: 6 }).notNull().default("0"),
    /** Placeholder for sector allocation JSON */
    sectorAllocation: numeric("sector_allocation").default("0"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_portfolios_account_id_idx").on(table.accountId),
  ],
);

export const insertPaperPortfolioSchema = createInsertSchema(paperPortfoliosTable).omit({
  id: true,
  updatedAt: true,
});

export const selectPaperPortfolioSchema = createSelectSchema(paperPortfoliosTable);

export type InsertPaperPortfolio = z.infer<typeof insertPaperPortfolioSchema>;
export type PaperPortfolio = typeof paperPortfoliosTable.$inferSelect;
