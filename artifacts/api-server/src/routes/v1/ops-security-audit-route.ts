import { Router, type IRouter } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { runSecurityAudit } from "../../services/security-audit-service";

const router: IRouter = Router();

/** Cached audit result — refreshed on each explicit run request */
let cachedAudit: Awaited<ReturnType<typeof runSecurityAudit>> | null = null;
let cachedAt: Date | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/v1/ops/security-audit
 * Return the latest security audit result (cached up to 5 min).
 */
router.get("/ops/security-audit", requireAuth, requirePermission("operations:read"), async (req, res) => {
  try {
    const now = new Date();
    const isStale = !cachedAudit || !cachedAt || (now.getTime() - cachedAt.getTime()) > CACHE_TTL_MS;

    if (isStale) {
      cachedAudit = await runSecurityAudit();
      cachedAt = now;
    }

    res.json({
      ...cachedAudit,
      cachedAt: cachedAt?.toISOString(),
      isStale: false,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to run security audit");
    res.status(500).json({ error: "Failed to run security audit" });
  }
});

/**
 * POST /api/v1/ops/security-audit/refresh
 * Force a fresh security audit run (bypasses cache).
 */
router.post("/ops/security-audit/refresh", requireAuth, requirePermission("operations:write"), async (req, res) => {
  try {
    cachedAudit = await runSecurityAudit();
    cachedAt = new Date();
    res.json({ ...cachedAudit, cachedAt: cachedAt.toISOString(), isStale: false });
  } catch (err) {
    req.log.error({ err }, "Failed to refresh security audit");
    res.status(500).json({ error: "Failed to refresh security audit" });
  }
});

export default router;
