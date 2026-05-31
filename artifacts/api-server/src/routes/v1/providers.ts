import { Router, type IRouter } from "express";
import { z } from "zod";
import { listProviders, listProviderHealth } from "../../services/providers-db";

const router: IRouter = Router();

const ListProvidersQuerySchema = z.object({
  status: z.enum(["active", "inactive", "degraded", "error", "unknown"]).optional(),
});

const HealthQuerySchema = z.object({
  provider: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((v: string | undefined) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(200)),
});

router.get("/providers", async (req, res) => {
  const parse = ListProvidersQuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const providers = await listProviders(parse.data);
  res.json({ data: providers, total: providers.length });
});

router.get("/providers/health", async (req, res) => {
  const parse = HealthQuerySchema.safeParse(req.query);
  if (!parse.success) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: parse.error.message },
    });
    return;
  }

  const records = await listProviderHealth({
    providerName: parse.data.provider,
    limit: parse.data.limit,
  });

  res.json({ data: records, total: records.length });
});

export default router;
