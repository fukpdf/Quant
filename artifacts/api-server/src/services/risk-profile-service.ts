import { logger } from "../lib/logger";
import {
  createRiskProfile,
  getDefaultRiskProfile,
  listRiskProfiles,
  appendAuditLog,
} from "./risk-db";
import type { RiskProfile } from "@workspace/db";

/**
 * Pre-defined institutional risk profiles.
 * Seeded on server startup (idempotent — skip if already present).
 */
const DEFAULT_PROFILES = [
  {
    name: "Conservative",
    description: "Maximum capital preservation. Tight limits across all dimensions. Suitable for live deployment.",
    profileType: "conservative" as const,
    maxPositionSizePct: "5",
    maxPortfolioExposurePct: "50",
    maxDailyLossPct: "1",
    maxDrawdownPct: "10",
    maxLeverage: "1",
    concentrationLimitPct: "15",
    maxWeeklyLossPct: "3",
    minStrategyConfidenceScore: "60",
    maxOpenPositions: 10,
    riskToleranceScore: 2,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Balanced",
    description: "Moderate risk-return tradeoff. Suitable for well-validated strategies in paper trading.",
    profileType: "balanced" as const,
    maxPositionSizePct: "10",
    maxPortfolioExposurePct: "75",
    maxDailyLossPct: "2",
    maxDrawdownPct: "15",
    maxLeverage: "1",
    concentrationLimitPct: "25",
    maxWeeklyLossPct: "5",
    minStrategyConfidenceScore: "40",
    maxOpenPositions: 20,
    riskToleranceScore: 5,
    isDefault: true,
    isActive: true,
  },
  {
    name: "Aggressive",
    description: "Higher risk tolerance for high-conviction strategies. Research and paper trading only.",
    profileType: "aggressive" as const,
    maxPositionSizePct: "20",
    maxPortfolioExposurePct: "95",
    maxDailyLossPct: "5",
    maxDrawdownPct: "30",
    maxLeverage: "1",
    concentrationLimitPct: "40",
    maxWeeklyLossPct: "10",
    minStrategyConfidenceScore: "20",
    maxOpenPositions: 50,
    riskToleranceScore: 8,
    isDefault: false,
    isActive: true,
  },
  {
    name: "Research",
    description: "Permissive profile for strategy development and testing. Very wide limits. Paper only.",
    profileType: "research" as const,
    maxPositionSizePct: "25",
    maxPortfolioExposurePct: "100",
    maxDailyLossPct: "10",
    maxDrawdownPct: "50",
    maxLeverage: "1",
    concentrationLimitPct: "50",
    maxWeeklyLossPct: "20",
    minStrategyConfidenceScore: "0",
    maxOpenPositions: 100,
    riskToleranceScore: 10,
    isDefault: false,
    isActive: true,
  },
] as const;

/**
 * Seed the default risk profiles on server startup.
 * Idempotent — skips if profiles already exist.
 */
export async function seedDefaultRiskProfiles(): Promise<void> {
  const existing = await listRiskProfiles();
  const existingNames = new Set(existing.map((p) => p.name));

  let seeded = 0;
  for (const profile of DEFAULT_PROFILES) {
    if (existingNames.has(profile.name)) continue;

    await createRiskProfile(profile);
    seeded++;
  }

  if (seeded > 0) {
    logger.info({ seeded }, "Seeded default risk profiles");

    await appendAuditLog({
      actor: "system",
      action: "risk_profiles.seed",
      entityType: "profile",
      payload: { seeded },
      result: "success",
    });
  }
}

/**
 * Resolve the active risk profile for a given account.
 * Falls back to the system default profile.
 * Future: accept accountId and return account-specific profile assignment.
 */
export async function resolveActiveProfile(
  _accountId?: string,
): Promise<RiskProfile | undefined> {
  return getDefaultRiskProfile();
}
