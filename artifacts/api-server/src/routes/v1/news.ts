import { Router, type IRouter } from "express";
import { z } from "zod";
import { listNewsItems } from "../../services/news";

const router: IRouter = Router();

const QuerySchema = z.object({
  source: z.string().max(100).optional(),
  category: z.string().max(50).optional(),
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

router.get("/news", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const items = await listNewsItems(parse.data);
  res.json({ data: items, total: items.length });
});

export default router;
