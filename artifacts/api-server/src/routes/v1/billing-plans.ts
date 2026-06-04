import { Router } from "express";
import { listBillingPlans, getBillingPlan } from "../../services/billing-db";

const router = Router();

router.get("/billing/plans", async (req, res) => {
  const plans = await listBillingPlans(true);
  res.json({ plans });
});

router.get("/billing/plans/:slug", async (req, res) => {
  const { slug } = req.params as Record<string, string>;
  const plan = await getBillingPlan(slug);
  if (!plan) {
    res.status(404).json({ error: { code: "PLAN_NOT_FOUND", message: `Plan '${slug}' not found` } });
    return;
  }
  res.json({ plan });
});

export default router;
