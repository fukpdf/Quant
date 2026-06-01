import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Named research configuration snapshots.
 * Allows the researcher to save and recall a specific backtest / walk-forward
 * / Monte Carlo configuration for reproducibility.
 *
 * snapshotType: single | portfolio | walk_forward | monte_carlo
 * referenceId: the ID of the run this snapshot was created from (nullable for drafts)
 * configuration: full JSON input used to create the run (for replay)
 */
export const researchSnapshotsTable = pgTable(
  "research_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    description: text("description"),
    /** single | portfolio | walk_forward | monte_carlo */
    snapshotType: varchar("snapshot_type", { length: 30 }).notNull(),
    /** ID of the originating run (optional) */
    referenceId: uuid("reference_id"),
    /** Full JSON config that can reproduce the run */
    configuration: text("configuration").notNull(),
    /** Tags for organisation, JSON array of strings */
    tags: text("tags"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("research_snapshots_type_idx").on(table.snapshotType),
    index("research_snapshots_created_at_idx").on(table.createdAt),
  ],
);

export const insertResearchSnapshotSchema = createInsertSchema(researchSnapshotsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const selectResearchSnapshotSchema = createSelectSchema(researchSnapshotsTable);

export type InsertResearchSnapshot = z.infer<typeof insertResearchSnapshotSchema>;
export type ResearchSnapshot = typeof researchSnapshotsTable.$inferSelect;
