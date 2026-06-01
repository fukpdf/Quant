import { Router, type IRouter } from "express";
import { listStrategyDefinitions } from "../../services/research-db";

const router: IRouter = Router();

/**
 * GET /v1/research/strategies
 * Returns all registered, active strategies with their parameter schemas.
 */
router.get("/research/strategies", async (req, res) => {
  const strategies = await listStrategyDefinitions();
  res.json({ data: strategies, total: strategies.length });
});

export default router;
