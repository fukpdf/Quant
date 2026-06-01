import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  listRiskProfiles,
  getRiskProfile,
  createRiskProfile,
  updateRiskProfile,
  appendAuditLog,
} from "../../services/risk-db";

const router: IRouter = Router();

const CreateRiskProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  profileType: z.enum(["conservative", "balanced", "aggressive", "research", "custom"]).default("custom"),
  maxPositionSizePct: z.number().positive().max(100).default(10),
  maxPortfolioExposurePct: z.number().positive().max(100).default(80),
  maxDailyLossPct: z.number().positive().max(100).default(3),
  maxDrawdownPct: z.number().positive().max(100).default(20),
  maxLeverage: z.number().positive().max(10).default(1),
  concentrationLimitPct: z.number().positive().max(100).default(25),
  maxWeeklyLossPct: z.number().positive().max(100).default(7),
  minStrategyConfidenceScore: z.number().min(0).max(100).default(0),
  maxOpenPositions: z.number().int().positive().max(500).default(20),
  riskToleranceScore: z.number().int().min(1).max(10).default(5),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

/**
 * GET /v1/risk/profiles
 * List all risk profiles.
 */
router.get("/risk/profiles", async (req, res) => {
  const activeOnly = req.query["activeOnly"] === "true";
  const profiles = await listRiskProfiles(activeOnly);
  res.json({ data: profiles, total: profiles.length });
});

/**
 * GET /v1/risk/profiles/:id
 * Get a specific risk profile.
 */
router.get("/risk/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const profile = await getRiskProfile(id);
  if (!profile) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Risk profile not found: ${id}` } });
    return;
  }
  res.json({ profile });
});

/**
 * POST /v1/risk/profiles
 * Create a new risk profile.
 */
router.post("/risk/profiles", async (req, res) => {
  const parse = CreateRiskProfileSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { maxPositionSizePct, maxPortfolioExposurePct, maxDailyLossPct, maxDrawdownPct,
          maxLeverage, concentrationLimitPct, maxWeeklyLossPct, minStrategyConfidenceScore,
          ...rest } = parse.data;

  const profile = await createRiskProfile({
    ...rest,
    maxPositionSizePct: String(maxPositionSizePct),
    maxPortfolioExposurePct: String(maxPortfolioExposurePct),
    maxDailyLossPct: String(maxDailyLossPct),
    maxDrawdownPct: String(maxDrawdownPct),
    maxLeverage: String(maxLeverage),
    concentrationLimitPct: String(concentrationLimitPct),
    maxWeeklyLossPct: String(maxWeeklyLossPct),
    minStrategyConfidenceScore: String(minStrategyConfidenceScore),
  });

  await appendAuditLog({
    actor: "api",
    action: "risk_profile.create",
    entityType: "profile",
    entityId: profile.id,
    payload: { name: profile.name, profileType: profile.profileType },
    result: "success",
  });

  res.status(201).json({ profile });
});

/**
 * PATCH /v1/risk/profiles/:id
 * Update a risk profile (partial update).
 */
router.patch("/risk/profiles/:id", async (req, res) => {
  const { id } = req.params;
  const existing = await getRiskProfile(id);
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Risk profile not found: ${id}` } });
    return;
  }

  const UpdateSchema = CreateRiskProfileSchema.partial();
  const parse = UpdateSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const { maxPositionSizePct, maxPortfolioExposurePct, maxDailyLossPct, maxDrawdownPct,
          maxLeverage, concentrationLimitPct, maxWeeklyLossPct, minStrategyConfidenceScore,
          ...rest } = parse.data;

  const numericFields: Record<string, string> = {};
  if (maxPositionSizePct !== undefined) numericFields["maxPositionSizePct"] = String(maxPositionSizePct);
  if (maxPortfolioExposurePct !== undefined) numericFields["maxPortfolioExposurePct"] = String(maxPortfolioExposurePct);
  if (maxDailyLossPct !== undefined) numericFields["maxDailyLossPct"] = String(maxDailyLossPct);
  if (maxDrawdownPct !== undefined) numericFields["maxDrawdownPct"] = String(maxDrawdownPct);
  if (maxLeverage !== undefined) numericFields["maxLeverage"] = String(maxLeverage);
  if (concentrationLimitPct !== undefined) numericFields["concentrationLimitPct"] = String(concentrationLimitPct);
  if (maxWeeklyLossPct !== undefined) numericFields["maxWeeklyLossPct"] = String(maxWeeklyLossPct);
  if (minStrategyConfidenceScore !== undefined) numericFields["minStrategyConfidenceScore"] = String(minStrategyConfidenceScore);

  const updated = await updateRiskProfile(id, { ...rest, ...numericFields });

  await appendAuditLog({
    actor: "api",
    action: "risk_profile.update",
    entityType: "profile",
    entityId: id,
    payload: parse.data,
    result: "success",
  });

  res.json({ profile: updated });
});

export default router;
