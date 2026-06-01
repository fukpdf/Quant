import { Router, type IRouter } from "express";
import { listCorrelationMatrices, getLatestCorrelationMatrix } from "../../services/risk-db";
import { computeAndStoreCorrelationMatrix } from "../../services/correlation-engine";

const router: IRouter = Router();

/**
 * GET /v1/risk/correlations
 * List stored correlation matrices or get the latest one.
 */
router.get("/risk/correlations", async (req, res) => {
  const { latest, windowDays, limit } = req.query as Record<string, string | undefined>;

  if (latest === "true") {
    const windowDaysParsed = windowDays ? parseInt(windowDays, 10) : 30;
    const matrix = await getLatestCorrelationMatrix(windowDaysParsed);
    if (!matrix) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "No correlation matrix found. Trigger a computation first." },
      });
      return;
    }
    res.json({ matrix });
    return;
  }

  const parsedLimit = limit ? parseInt(limit, 10) : 30;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–200" } });
    return;
  }

  const matrices = await listCorrelationMatrices(parsedLimit);
  res.json({ data: matrices, total: matrices.length });
});

/**
 * POST /v1/risk/correlations/compute
 * Manually trigger a correlation matrix computation.
 */
router.post("/risk/correlations/compute", async (req, res) => {
  const windowDays = req.body?.windowDays ? parseInt(String(req.body.windowDays), 10) : 30;

  if (isNaN(windowDays) || windowDays < 5 || windowDays > 365) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "windowDays must be 5–365" },
    });
    return;
  }

  const matrix = await computeAndStoreCorrelationMatrix(windowDays);

  if (!matrix) {
    res.status(422).json({
      error: {
        code: "INSUFFICIENT_DATA",
        message: "Not enough market data to compute correlation matrix. Need at least 5 daily candles per symbol.",
      },
    });
    return;
  }

  res.status(201).json({ matrix });
});

export default router;
