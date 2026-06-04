import { db } from "@workspace/db";
import { backupJobsTable } from "@workspace/db/schema";
import { and, eq, lt, isNotNull } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runBackup, seedDefaultBackupJobs, expireOldRuns } from "./backup-service";
import { runRestoreTest } from "./restore-service";

/**
 * backup-scheduler.ts — Automated backup scheduling.
 *
 * Runs two background loops:
 *  1. Backup loop: checks for due jobs every 5 minutes, executes overdue runs
 *  2. Restore test loop: validates latest completed backup every 6 hours
 *
 * Both loops are non-fatal — errors are logged but do not crash the scheduler.
 */

const BACKUP_POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const RESTORE_TEST_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const EXPIRE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let backupIntervalId: ReturnType<typeof setInterval> | null = null;
let restoreTestIntervalId: ReturnType<typeof setInterval> | null = null;
let expireIntervalId: ReturnType<typeof setInterval> | null = null;

export async function startBackupScheduler(): Promise<void> {
  try {
    await seedDefaultBackupJobs();
  } catch (err) {
    logger.error({ err }, "Backup scheduler: failed to seed default jobs");
  }

  // Backup loop
  backupIntervalId = setInterval(() => {
    void runDueBackups();
  }, BACKUP_POLL_INTERVAL_MS);

  // Restore test loop
  restoreTestIntervalId = setInterval(() => {
    void runScheduledRestoreTest();
  }, RESTORE_TEST_INTERVAL_MS);

  // Expiry cleanup loop
  expireIntervalId = setInterval(() => {
    void expireOldRuns();
  }, EXPIRE_INTERVAL_MS);

  // Run initial backup check after 2 minutes (let server fully start)
  setTimeout(() => { void runDueBackups(); }, 2 * 60 * 1000);

  logger.info(
    {
      backupPollMs: BACKUP_POLL_INTERVAL_MS,
      restoreTestMs: RESTORE_TEST_INTERVAL_MS,
    },
    "Backup scheduler started",
  );
}

export function stopBackupScheduler(): void {
  if (backupIntervalId) clearInterval(backupIntervalId);
  if (restoreTestIntervalId) clearInterval(restoreTestIntervalId);
  if (expireIntervalId) clearInterval(expireIntervalId);
  logger.info("Backup scheduler stopped");
}

async function runDueBackups(): Promise<void> {
  try {
    const now = new Date();
    const dueJobs = await db
      .select()
      .from(backupJobsTable)
      .where(
        and(
          eq(backupJobsTable.isActive, true),
          isNotNull(backupJobsTable.nextRunAt),
          lt(backupJobsTable.nextRunAt, now),
        ),
      );

    if (dueJobs.length === 0) return;

    logger.info({ count: dueJobs.length }, "Backup scheduler: running due jobs");

    for (const job of dueJobs) {
      try {
        await runBackup(job.id, "system");
      } catch (err) {
        logger.error({ jobId: job.id, jobName: job.name, err }, "Backup scheduler: job failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "Backup scheduler: error checking due jobs");
  }
}

async function runScheduledRestoreTest(): Promise<void> {
  try {
    const { getLatestSuccessfulBackup } = await import("./backup-service");
    const latestBackup = await getLatestSuccessfulBackup();
    if (!latestBackup) {
      logger.info("Backup scheduler: no completed backup to test");
      return;
    }
    if (latestBackup.isValidated) {
      logger.info({ runId: latestBackup.id }, "Backup scheduler: latest backup already validated");
      return;
    }
    await runRestoreTest(latestBackup.id, "full", "system");
    logger.info({ runId: latestBackup.id }, "Backup scheduler: scheduled restore test completed");
  } catch (err) {
    logger.error({ err }, "Backup scheduler: scheduled restore test failed");
  }
}
