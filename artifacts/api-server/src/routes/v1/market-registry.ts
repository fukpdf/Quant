import { Router, type IRouter } from "express";
import { z } from "zod";
import { listMarketRegistry } from "../../services/market-registry";

const router: IRouter = Router();

const QuerySchema = z.object({
  type: z
    .enum(["crypto", "forex", "stock", "index", "commodity"])
    .optional(),
  active: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v === undefined ? undefined : v === "true")),
  provider: z.string().optional(),
});

router.get("/market-registry", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const entries = await listMarketRegistry(parse.data);
  res.json({ data: entries, total: entries.length });
});

export default router;
