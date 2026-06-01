import { Router, type IRouter } from "express";
import { z } from "zod";
import { compareRuns } from "../../services/comparison-engine";

const router: IRouter = Router();

const QuerySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((v: string) => v.split(",").map((s: string) => s.trim()).filter(Boolean)),
});

/**
 * GET /v1/research/compare?ids=<id1>,<id2>[,<id3>...]
 * Compare two or more backtest runs side-by-side across all performance metrics.
 */
router.get("/research/compare", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const { ids } = parse.data;

  if (ids.length < 2) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide at least 2 run IDs separated by commas (e.g. ?ids=<id1>,<id2>)",
      },
    });
    return;
  }

  try {
    const result = await compareRuns(ids);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not found")) {
      res.status(404).json({ error: { code: "NOT_FOUND", message } });
    } else {
      res.status(400).json({ error: { code: "COMPARISON_ERROR", message } });
    }
  }
});

export default router;
