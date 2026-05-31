import { Router, type IRouter } from "express";
import { z } from "zod";
import { listMarkets } from "../../services/market-data";

const router: IRouter = Router();

const QuerySchema = z.object({
  type: z
    .enum(["crypto", "forex", "stock", "index", "commodity"])
    .optional(),
  active: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v === undefined ? undefined : v === "true")),
});

router.get("/markets", async (req, res) => {
  const parse = QuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const markets = await listMarkets(parse.data);

  res.json({ data: markets, total: markets.length });
});

export default router;
