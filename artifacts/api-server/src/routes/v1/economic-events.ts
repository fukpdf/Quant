import { Router, type IRouter } from "express";
import { z } from "zod";
import { listEconomicEvents } from "../../services/economic-events";

const router: IRouter = Router();

const QuerySchema = z.object({
  country: z.string().max(10).toUpperCase().optional(),
  impact: z.enum(["low", "medium", "high", "critical"]).optional(),
  from: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? new Date(v) : undefined)),
  to: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? new Date(v) : undefined)),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

router.get("/economic-events", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const events = await listEconomicEvents(parse.data);
  res.json({ data: events, total: events.length });
});

export default router;
