import { Router, type IRouter } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import {
  listBackupJobs,
  getBackupJob,
  setJobActive,
  listBackupRuns,
  getBackupRun,
  getLatestSuccessfulBackup,
  listBackupAuditLog,
  runBackup,
} from "../../services/backup-service";

const router: IRouter = Router();

/**
 * GET /api/v1/ops/backups
 * List all backup jobs with their latest run status.
 */
router.get("/ops/backups", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const jobs = await listBackupJobs();
    const latest = await getLatestSuccessfulBackup();
    res.json({ jobs, latestSuccessfulBackup: latest });
  } catch (err) {
    req.log.error({ err }, "Failed to list backup jobs");
    res.status(500).json({ error: "Failed to list backup jobs" });
  }
});

/**
 * GET /api/v1/ops/backups/:id
 * Get a specific backup job with its recent runs.
 */
router.get("/ops/backups/:id", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const job = await getBackupJob(id);
    if (!job) return res.status(404).json({ error: "Backup job not found" });

    const runs = await listBackupRuns(id, 20);
    return res.json({ job, runs });
  } catch (err) {
    req.log.error({ err }, "Failed to get backup job");
    return res.status(500).json({ error: "Failed to get backup job" });
  }
});

/**
 * POST /api/v1/ops/backups/:id/run
 * Trigger an immediate backup run for a job.
 */
router.post("/ops/backups/:id/run", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const job = await getBackupJob(id);
    if (!job) return res.status(404).json({ error: "Backup job not found" });
    if (!job.isActive) return res.status(400).json({ error: "Backup job is not active" });

    const actor = (req as unknown as { auth?: { userId?: string } }).auth?.userId ?? "operator";
    const run = await runBackup(id, actor);
    return res.json({ run });
  } catch (err) {
    req.log.error({ err }, "Failed to trigger backup run");
    return res.status(500).json({ error: "Failed to trigger backup run" });
  }
});

/**
 * PATCH /api/v1/ops/backups/:id/toggle
 * Enable or disable a backup job.
 */
router.patch("/ops/backups/:id/toggle", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const job = await getBackupJob(id);
    if (!job) return res.status(404).json({ error: "Backup job not found" });

    await setJobActive(id, !job.isActive);
    return res.json({ success: true, isActive: !job.isActive });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle backup job");
    return res.status(500).json({ error: "Failed to toggle backup job" });
  }
});

/**
 * GET /api/v1/ops/backups/:id/runs
 * List runs for a specific backup job.
 */
router.get("/ops/backups/:id/runs", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const runs = await listBackupRuns(id, limit);
    return res.json(runs);
  } catch (err) {
    req.log.error({ err }, "Failed to list backup runs");
    return res.status(500).json({ error: "Failed to list backup runs" });
  }
});

/**
 * GET /api/v1/ops/backup-runs/:id
 * Get a specific backup run.
 */
router.get("/ops/backup-runs/:id", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const run = await getBackupRun(id);
    if (!run) return res.status(404).json({ error: "Backup run not found" });
    return res.json(run);
  } catch (err) {
    req.log.error({ err }, "Failed to get backup run");
    return res.status(500).json({ error: "Failed to get backup run" });
  }
});

/**
 * GET /api/v1/ops/backup-audit-log
 * Immutable audit log for all backup operations.
 */
router.get("/ops/backup-audit-log", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 100), 500);
    const logs = await listBackupAuditLog(limit);
    return res.json(logs);
  } catch (err) {
    req.log.error({ err }, "Failed to list backup audit log");
    return res.status(500).json({ error: "Failed to list backup audit log" });
  }
});

export default router;
