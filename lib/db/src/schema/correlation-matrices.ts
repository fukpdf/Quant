import {
  pgTable,
  uuid,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Asset correlation matrix snapshots.
 * Computed periodically using Pearson correlation on daily returns.
 * Stored as serialized JSON for efficient retrieval.
 *
 * symbols: string[] — ordered list of assets in the matrix
 * matrix: number[][] — NxN Pearson correlation coefficients [-1, 1]
 */
export const correlationMatricesTable = pgTable(
  "correlation_matrices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Ordered list of symbols in this matrix, e.g. ["BTCUSDT","ETHUSDT","SOLUSDT"] */
    symbols: jsonb("symbols").notNull(),
    /** NxN matrix of Pearson correlation coefficients */
    matrix: jsonb("matrix").notNull(),
    /** Rolling window in calendar days used for computation */
    windowDays: integer("window_days").notNull().default(30),
    /** Average off-diagonal absolute correlation — higher = more correlated portfolio */
    correlationRiskScore: numeric("correlation_risk_score", { precision: 6, scale: 4 }).notNull().default("0"),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("correlation_matrices_calculated_at_idx").on(table.calculatedAt),
  ],
);

export const insertCorrelationMatrixSchema = createInsertSchema(correlationMatricesTable).omit({
  id: true,
  createdAt: true,
});

export const selectCorrelationMatrixSchema = createSelectSchema(correlationMatricesTable);

export type InsertCorrelationMatrix = z.infer<typeof insertCorrelationMatrixSchema>;
export type CorrelationMatrix = typeof correlationMatricesTable.$inferSelect;
