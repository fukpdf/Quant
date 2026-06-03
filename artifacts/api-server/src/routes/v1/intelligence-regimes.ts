import { Router } from "express";
import { z } from "zod/v4";
import {
  detectAndPersistRegime,
  runRegimeDetectionForSymbols,
  listMarketRegimes,
  getMarketRegimeById,
} from "../../services/regime-detection-engine";

/**
 * intelligence-regimes.ts — Market Regime Detection endpoints.
 *
 * GET  /v1/intelligence/regimes          — list regime records
 * GET  /v1/intelligence/regimes/:id      — get specific regime
 * POST /v1/intelligence/regimes/detect   — trigger detection for one or more symbols
 */

const router = Router();

const DetectSchema = z.object({
  symbols: z.array(z.string().min(2).max(30)).min(1).max(20),
  lookbackDays: z.number().int().min(7).max(365).optional().default(30),
});

// GET /v1/intelligence/regimes
router.get("/intelligence/regimes", async (req, res) => {
  const symbol = typeof req.query.symbol === "string" ? req.query.symbol : undefined;
  const regimeType = typeof req.query.regime_type === "string" ? req.query.regime_type : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const regimes = await listMarketRegimes({ symbol, regimeType, status, limit, offset });
    return res.json({ data: regimes, count: regimes.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list market regimes");
    return res.status(500).json({ error: "Failed to list market regimes" });
  }
});

// GET /v1/intelligence/regimes/:id
router.get("/intelligence/regimes/:id", async (req, res) => {
  try {
    const regime = await getMarketRegimeById(req.params.id);
    if (!regime) return res.status(404).json({ error: "Regime not found" });
    return res.json({ data: regime });
  } catch (err) {
    req.log?.error({ err }, "Failed to get market regime");
    return res.status(500).json({ error: "Failed to get market regime" });
  }
});

// POST /v1/intelligence/regimes/detect
router.post("/intelligence/regimes/detect", async (req, res) => {
  const parsed = DetectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  const { symbols, lookbackDays } = parsed.data;

  try {
    if (symbols.length === 1) {
      const regime = await detectAndPersistRegime(symbols[0], lookbackDays as number);
      return res.status(201).json({ data: regime });
    }
    const summary = await runRegimeDetectionForSymbols(symbols);
    return res.status(201).json({ data: summary });
  } catch (err) {
    req.log?.error({ err }, "Regime detection failed");
    return res.status(500).json({ error: "Regime detection failed" });
  }
});

export default router;
