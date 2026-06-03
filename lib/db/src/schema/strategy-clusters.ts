import {
  pgTable,
  uuid,
  varchar,
  numeric,
  timestamp,
  index,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * strategy_clusters — groups of strategies with similar behavior.
 *
 * The CorrelationEngine groups strategies by their return correlations,
 * performance characteristics, or regime behavior. Enables diversification
 * analysis — ideally the portfolio spans multiple distinct clusters.
 *
 * cluster_method: correlation | performance | regime | combined
 */
export const strategyClustersTable = pgTable(
  "strategy_clusters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Human-readable cluster label (auto-generated or AI-named) */
    clusterName: varchar("cluster_name", { length: 100 }).notNull(),
    /** Ordered list of strategy names in this cluster */
    strategyNames: jsonb("strategy_names").notNull().default([]),
    /** correlation | performance | regime | combined */
    clusterMethod: varchar("cluster_method", { length: 30 }).notNull(),
    /** Centroid feature vector used for clustering */
    centroid: jsonb("centroid").notNull().default({}),
    /** Average pairwise correlation among cluster members (0–1) */
    avgCorrelation: numeric("avg_correlation", { precision: 8, scale: 6 }),
    /** Average Sharpe ratio of cluster members */
    avgSharpe: numeric("avg_sharpe", { precision: 10, scale: 6 }),
    /** Average max drawdown of cluster members */
    avgMaxDrawdown: numeric("avg_max_drawdown", { precision: 10, scale: 6 }),
    /** Diversification score within the cluster (lower = more homogeneous) */
    diversificationScore: numeric("diversification_score", { precision: 8, scale: 4 }),
    /** Number of strategies in the cluster */
    clusterSize: numeric("cluster_size", { precision: 5, scale: 0 }).notNull().default("0"),
    /** Silhouette score for cluster quality (-1 to 1, higher = tighter cluster) */
    silhouetteScore: numeric("silhouette_score", { precision: 8, scale: 6 }),
    /** Regime affinity { bull: 0.8, bear: 0.2, ... } */
    regimeAffinity: jsonb("regime_affinity").notNull().default({}),
    /** active | archived */
    status: varchar("status", { length: 20 }).notNull().default("active"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("strategy_clusters_method_idx").on(table.clusterMethod),
    index("strategy_clusters_status_idx").on(table.status),
    index("strategy_clusters_computed_at_idx").on(table.computedAt),
    index("strategy_clusters_avg_correlation_idx").on(table.avgCorrelation),
  ],
);

export const insertStrategyClusterSchema = createInsertSchema(strategyClustersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectStrategyClusterSchema = createSelectSchema(strategyClustersTable);

export type InsertStrategyCluster = z.infer<typeof insertStrategyClusterSchema>;
export type StrategyCluster = typeof strategyClustersTable.$inferSelect;
