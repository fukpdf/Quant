import { Router, type IRouter } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import {
  listRestoreTests,
  getRestoreTest,
  getLatestRestoreTest,
  runRestoreTest,
} from "../../services/restore-service";

const router: IRouter = Router();

/**
 * GET /api/v1/ops/recovery
 * List all restore test records.
 */
router.get("/ops/recovery", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const backupRunId = req.query["backupRunId"] as string | undefined;
    const [tests, latest] = await Promise.all([
      listRestoreTests(backupRunId, limit),
      getLatestRestoreTest(),
    ]);
    res.json({ tests, latestTest: latest });
  } catch (err) {
    req.log.error({ err }, "Failed to list restore tests");
    res.status(500).json({ error: "Failed to list restore tests" });
  }
});

/**
 * GET /api/v1/ops/recovery/:id
 * Get a specific restore test record.
 */
router.get("/ops/recovery/:id", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const { id } = req.params as Record<string, string>;
    const test = await getRestoreTest(id);
    if (!test) return res.status(404).json({ error: "Restore test not found" });
    return res.json(test);
  } catch (err) {
    req.log.error({ err }, "Failed to get restore test");
    return res.status(500).json({ error: "Failed to get restore test" });
  }
});

/**
 * POST /api/v1/ops/recovery/test
 * Trigger a restore test for a specific backup run.
 */
router.post("/ops/recovery/test", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    const { backupRunId, testType } = req.body as {
      backupRunId?: string;
      testType?: "checksum" | "row_count" | "schema" | "full";
    };

    if (!backupRunId) return res.status(400).json({ error: "backupRunId is required" });

    const validTypes = ["checksum", "row_count", "schema", "full"] as const;
    const type = validTypes.includes(testType as typeof validTypes[number]) ? testType! : "checksum";

    const actor = (req as unknown as { auth?: { userId?: string } }).auth?.userId ?? "operator";
    const test = await runRestoreTest(backupRunId, type, actor);
    return res.json(test);
  } catch (err) {
    req.log.error({ err }, "Failed to run restore test");
    const errMsg = err instanceof Error ? err.message : "Failed to run restore test";
    return res.status(500).json({ error: errMsg });
  }
});

export default router;
