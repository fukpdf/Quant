import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { getLatestRevenue, getRevenueHistory, snapshotRevenueMetrics } from "../../services/revenue-analytics-service";
import { listBillingEvents } from "../../services/billing-db";

const router = Router();

// GET /billing/revenue — current MRR/ARR/churn metrics (admin only)
router.get("/billing/revenue", requireAuth, requirePermission("operations:admin"), async (req, res) => {
  const metrics = await getLatestRevenue();
  res.json({ metrics });
});

// GET /billing/revenue/history — historical revenue snapshots
router.get("/billing/revenue/history", requireAuth, requirePermission("operations:admin"), async (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 30), 365);
  const history = await getRevenueHistory(limit);
  res.json({ history });
});

// POST /billing/revenue/snapshot — force a revenue snapshot (admin)
router.post("/billing/revenue/snapshot", requireAuth, requirePermission("operations:admin"), async (req, res) => {
  const snapshot = await snapshotRevenueMetrics();
  res.json({ snapshot });
});

// GET /billing/events — billing event audit log (admin only)
router.get("/billing/events", requireAuth, requirePermission("operations:admin"), async (req, res) => {
  const limit  = Math.min(Number(req.query["limit"]  ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);
  const events = await listBillingEvents(limit, offset);
  res.json({ events });
});

export default router;
