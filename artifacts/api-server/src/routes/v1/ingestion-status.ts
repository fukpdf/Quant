import { Router, type IRouter } from "express";
import { z } from "zod";
import { listIngestionLogs } from "../../services/market-data";

const router: IRouter = Router();

const QuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

router.get("/ingestion/status", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const logs = await listIngestionLogs(parse.data.limit);

  res.json({ data: logs, total: logs.length });
});

export default router;
