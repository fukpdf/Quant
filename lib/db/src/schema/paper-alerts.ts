import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { paperAccountsTable } from "./paper-accounts";

/**
 * Paper trading alerts.
 * Generated automatically by the alert manager based on account/position state.
 * No email/SMS delivery yet — architecture placeholder for future phases.
 *
 * type:
 *   large_drawdown | strategy_failure | position_concentration |
 *   equity_threshold | missed_data | execution_failure
 *
 * severity: info | warning | critical
 */
export const paperAlertsTable = pgTable(
  "paper_alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .references(() => paperAccountsTable.id),
    /**
     * large_drawdown | strategy_failure | position_concentration |
     * equity_threshold | missed_data | execution_failure
     */
    alertType: varchar("alert_type", { length: 50 }).notNull(),
    /** info | warning | critical */
    severity: varchar("severity", { length: 20 }).notNull(),
    /** Short human-readable message */
    message: text("message").notNull(),
    /** JSON payload with additional context (values, thresholds, etc.) */
    payload: text("payload"),
    /** Whether the alert has been acknowledged (read) */
    acknowledged: boolean("acknowledged").notNull().default(false),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("paper_alerts_account_id_idx").on(table.accountId),
    index("paper_alerts_alert_type_idx").on(table.alertType),
    index("paper_alerts_severity_idx").on(table.severity),
    index("paper_alerts_acknowledged_idx").on(table.acknowledged),
    index("paper_alerts_created_at_idx").on(table.createdAt),
  ],
);

export const insertPaperAlertSchema = createInsertSchema(paperAlertsTable).omit({
  id: true,
  createdAt: true,
});

export const selectPaperAlertSchema = createSelectSchema(paperAlertsTable);

export type InsertPaperAlert = z.infer<typeof insertPaperAlertSchema>;
export type PaperAlert = typeof paperAlertsTable.$inferSelect;
