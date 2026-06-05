import { db } from "@workspace/db";
import {
  portfolioAnalyticsTable,
  portfolioPerformanceTable,
  portfolioHealthScoresTable,
  portfolioRecommendationsTable,
  allocationSnapshotsTable,
  portfolioAttributionTable,
  riskDecisionsTable,
  riskEventsTable,
  riskViolationsTable,
  circuitBreakerEventsTable,
  killSwitchEventsTable,
  drawdownEventsTable,
  strategyRiskScoresTable,
  paperAccountsTable,
  paperPortfoliosTable,
  paperPositionsTable,
  paperTradeHistoryTable,
  paperAlertsTable,
  strategyDefinitionsTable,
  portfolioBenchmarksTable,
  benchmarkSnapshotsTable,
} from "@workspace/db";
import { eq, desc, and, lte } from "drizzle-orm";
import type {
  AiContext,
  ContextDomain,
  PortfolioContextData,
  RiskContextData,
  PaperContextData,
  ResearchContextData,
  BenchmarkContextData,
  HealthContextData,
  RecommendationContextData,
} from "./ai-types";
import { logger } from "../lib/logger";

/**
 * AI Context Builder — aggregates platform data into a unified context snapshot.
 *
 * The context builder reads ONLY from stored analytics tables. It does not
 * trigger recomputation and has no write side effects. It is the data access
 * layer for the AI layer — the AI sees only what the platform has already computed.
 *
 * Data freshness depends on the Phase 7 analytics scheduler intervals:
 *   - Health: up to 1h stale
 *   - Performance: up to 1d stale
 *   - Allocation: up to 15m stale
 *   - Benchmarks: up to 6h stale
 */
export async function buildContext(opts: {
  accountId?: string;
  domains?: ContextDomain[];
}): Promise<AiContext> {
  const domains: ContextDomain[] = opts.domains ?? ["portfolio", "risk", "paper", "research", "benchmark", "health", "recommendations"];

  const context: AiContext = {
    domains,
    accountId: opts.accountId,
    builtAt: new Date().toISOString(),
    contextSizeChars: 0,
  };

  const promises: Promise<void>[] = [];

  if (domains.includes("portfolio") && opts.accountId) {
    promises.push(
      buildPortfolioContext(opts.accountId).then((d) => { context.portfolioData = d; }),
    );
  }

  if (domains.includes("risk")) {
    promises.push(
      buildRiskContext(opts.accountId).then((d) => { context.riskData = d; }),
    );
  }

  if (domains.includes("paper") && opts.accountId) {
    promises.push(
      buildPaperContext(opts.accountId).then((d) => { context.paperData = d; }),
    );
  }

  if (domains.includes("research")) {
    promises.push(
      buildResearchContext().then((d) => { context.researchData = d; }),
    );
  }

  if (domains.includes("benchmark")) {
    promises.push(
      buildBenchmarkContext().then((d) => { context.benchmarkData = d; }),
    );
  }

  if (domains.includes("health") && opts.accountId) {
    promises.push(
      buildHealthContext(opts.accountId).then((d) => { context.healthData = d; }),
    );
  }

  if (domains.includes("recommendations") && opts.accountId) {
    promises.push(
      buildRecommendationContext(opts.accountId).then((d) => { context.recommendationData = d; }),
    );
  }

  await Promise.allSettled(promises);

  // Measure the approximate context size for the audit log
  context.contextSizeChars = JSON.stringify(context).length;

  return context;
}

async function buildPortfolioContext(accountId: string): Promise<PortfolioContextData> {
  try {
    const [analyticsRows, perfRows, attrRows, allocRows] = await Promise.all([
      db.select().from(portfolioAnalyticsTable).where(eq(portfolioAnalyticsTable.accountId, accountId)).orderBy(desc(portfolioAnalyticsTable.snapshotAt)).limit(1),
      db.select().from(portfolioPerformanceTable).where(eq(portfolioPerformanceTable.accountId, accountId)).orderBy(desc(portfolioPerformanceTable.computedAt)).limit(1),
      db.select().from(portfolioAttributionTable).where(eq(portfolioAttributionTable.accountId, accountId)).orderBy(desc(portfolioAttributionTable.computedAt)).limit(1),
      db.select().from(allocationSnapshotsTable).where(eq(allocationSnapshotsTable.accountId, accountId)).orderBy(desc(allocationSnapshotsTable.snapshotAt)).limit(1),
    ]);

    return {
      analytics: analyticsRows[0] as Record<string, unknown> | undefined,
      performance: perfRows[0] as Record<string, unknown> | undefined,
      attribution: attrRows[0] as Record<string, unknown> | undefined,
      allocation: allocRows[0] as Record<string, unknown> | undefined,
    };
  } catch (err) {
    logger.warn({ err, accountId }, "Failed to build portfolio context");
    return {};
  }
}

async function buildRiskContext(accountId?: string): Promise<RiskContextData> {
  try {
    const [decisionsRows, eventsRows, violationsRows, cbRows, ksRows, ddRows, scoreRows] = await Promise.all([
      db.select().from(riskDecisionsTable).orderBy(desc(riskDecisionsTable.createdAt)).limit(10),
      db.select().from(riskEventsTable).orderBy(desc(riskEventsTable.createdAt)).limit(10),
      db.select().from(riskViolationsTable).orderBy(desc(riskViolationsTable.createdAt)).limit(10),
      db.select().from(circuitBreakerEventsTable).orderBy(desc(circuitBreakerEventsTable.createdAt)).limit(5),
      db.select().from(killSwitchEventsTable).orderBy(desc(killSwitchEventsTable.createdAt)).limit(5),
      db.select().from(drawdownEventsTable).orderBy(desc(drawdownEventsTable.createdAt)).limit(5),
      db.select().from(strategyRiskScoresTable).orderBy(desc(strategyRiskScoresTable.calculatedAt)).limit(10),
    ]);

    return {
      recentDecisions: decisionsRows as Record<string, unknown>[],
      recentEvents: eventsRows as Record<string, unknown>[],
      violations: violationsRows as Record<string, unknown>[],
      circuitBreakers: { recentEvents: cbRows } as Record<string, unknown>,
      killSwitchStatus: { recentEvents: ksRows } as Record<string, unknown>,
      drawdownEvents: ddRows as Record<string, unknown>[],
      strategyRiskScores: scoreRows as Record<string, unknown>[],
    };
  } catch (err) {
    logger.warn({ err }, "Failed to build risk context");
    return {};
  }
}

async function buildPaperContext(accountId: string): Promise<PaperContextData> {
  try {
    const [accountRows, portfolioRows, positionRows, tradeRows, alertRows] = await Promise.all([
      db.select().from(paperAccountsTable).where(eq(paperAccountsTable.id, accountId)).limit(1),
      db.select().from(paperPortfoliosTable).where(eq(paperPortfoliosTable.accountId, accountId)).orderBy(desc(paperPortfoliosTable.updatedAt)).limit(1),
      db.select().from(paperPositionsTable).where(and(eq(paperPositionsTable.accountId, accountId), eq(paperPositionsTable.status, "open"))).limit(20),
      db.select().from(paperTradeHistoryTable).where(eq(paperTradeHistoryTable.accountId, accountId)).orderBy(desc(paperTradeHistoryTable.exitedAt)).limit(20),
      db.select().from(paperAlertsTable).where(eq(paperAlertsTable.accountId, accountId)).orderBy(desc(paperAlertsTable.createdAt)).limit(10),
    ]);

    return {
      account: accountRows[0] as Record<string, unknown> | undefined,
      portfolio: portfolioRows[0] as Record<string, unknown> | undefined,
      openPositions: positionRows as Record<string, unknown>[],
      recentTrades: tradeRows as Record<string, unknown>[],
      alerts: alertRows as Record<string, unknown>[],
    };
  } catch (err) {
    logger.warn({ err, accountId }, "Failed to build paper context");
    return {};
  }
}

async function buildResearchContext(): Promise<ResearchContextData> {
  try {
    const [strategyRows] = await Promise.all([
      db.select().from(strategyDefinitionsTable).limit(20),
    ]);

    return {
      strategies: strategyRows as Record<string, unknown>[],
    };
  } catch (err) {
    logger.warn({ err }, "Failed to build research context");
    return {};
  }
}

async function buildBenchmarkContext(): Promise<BenchmarkContextData> {
  try {
    const [benchmarkRows] = await Promise.all([
      db.select().from(portfolioBenchmarksTable).where(eq(portfolioBenchmarksTable.isActive, true)).limit(10),
    ]);

    const snapshotRows = benchmarkRows.length > 0
      ? await db.select().from(benchmarkSnapshotsTable).where(eq(benchmarkSnapshotsTable.benchmarkId, benchmarkRows[0]!.id)).orderBy(desc(benchmarkSnapshotsTable.snapshotAt)).limit(30)
      : [];

    return {
      benchmarks: benchmarkRows as Record<string, unknown>[],
      snapshots: snapshotRows as Record<string, unknown>[],
    };
  } catch (err) {
    logger.warn({ err }, "Failed to build benchmark context");
    return {};
  }
}

async function buildHealthContext(accountId: string): Promise<HealthContextData> {
  try {
    const rows = await db
      .select()
      .from(portfolioHealthScoresTable)
      .where(eq(portfolioHealthScoresTable.accountId, accountId))
      .orderBy(desc(portfolioHealthScoresTable.scoredAt))
      .limit(1);

    const latest = rows[0];
    if (!latest) return {};

    return {
      score: parseFloat(latest.overallScore ?? "0"),
      grade: latest.grade,
      dimensions: {
        diversification: latest.diversificationScore,
        performance: latest.performanceScore,
        risk: latest.riskScore,
        consistency: latest.consistencyScore,
        capitalEfficiency: latest.capitalEfficiencyScore,
      },
    };
  } catch (err) {
    logger.warn({ err, accountId }, "Failed to build health context");
    return {};
  }
}

async function buildRecommendationContext(accountId: string): Promise<RecommendationContextData> {
  try {
    const rows = await db
      .select()
      .from(portfolioRecommendationsTable)
      .where(and(
        eq(portfolioRecommendationsTable.accountId, accountId),
        eq(portfolioRecommendationsTable.isAcknowledged, false),
      ))
      .orderBy(desc(portfolioRecommendationsTable.createdAt))
      .limit(10);

    return { active: rows as Record<string, unknown>[] };
  } catch (err) {
    logger.warn({ err, accountId }, "Failed to build recommendation context");
    return {};
  }
}

/**
 * Convert an AiContext to a text prompt section for injection into LLM messages.
 * Produces a structured, human-readable summary of the platform state.
 * Truncates large data sets to avoid exceeding token limits.
 */
export function formatContextAsPrompt(context: AiContext): string {
  const lines: string[] = [
    "=== QUANTFORGE PLATFORM CONTEXT ===",
    `Context built at: ${context.builtAt}`,
    `Account ID: ${context.accountId ?? "none"}`,
    `Domains: ${context.domains.join(", ")}`,
    "",
  ];

  if (context.healthData) {
    lines.push("--- PORTFOLIO HEALTH ---");
    lines.push(`Score: ${context.healthData.score ?? "N/A"} | Grade: ${context.healthData.grade ?? "N/A"}`);
    if (context.healthData.dimensions) {
      lines.push(`Dimensions: ${JSON.stringify(context.healthData.dimensions)}`);
    }
    lines.push("");
  }

  if (context.portfolioData?.performance) {
    lines.push("--- PERFORMANCE METRICS ---");
    lines.push(formatObject(context.portfolioData.performance, ["twr", "mwr", "sharpeRatio", "sortinoRatio", "calmarRatio", "alpha", "beta", "maxDrawdown", "totalReturn"]));
    lines.push("");
  }

  if (context.portfolioData?.analytics) {
    lines.push("--- PORTFOLIO ANALYTICS ---");
    lines.push(formatObject(context.portfolioData.analytics, ["totalValue", "cashBalance", "openPositions", "totalExposure", "unrealizedPnl", "realizedPnl"]));
    lines.push("");
  }

  if (context.portfolioData?.allocation) {
    lines.push("--- ALLOCATION ---");
    lines.push(formatObject(context.portfolioData.allocation, ["allocationData", "driftPct"]));
    lines.push("");
  }

  if (context.riskData) {
    lines.push("--- RISK ENGINE STATUS ---");
    if (context.riskData.recentDecisions?.length) {
      const decisions = context.riskData.recentDecisions.slice(0, 5);
      lines.push(`Recent decisions (last 5): ${decisions.map((d: any) => `${d.decision}(${d.strategyName})`).join(", ")}`);
    }
    if (context.riskData.recentEvents?.length) {
      const events = context.riskData.recentEvents.slice(0, 5);
      lines.push(`Recent events (last 5): ${events.map((e: any) => `[${e.severity}] ${e.eventType}`).join(", ")}`);
    }
    if (context.riskData.drawdownEvents?.length) {
      lines.push(`Active drawdown events: ${context.riskData.drawdownEvents.length}`);
    }
    lines.push("");
  }

  if (context.paperData) {
    lines.push("--- PAPER TRADING ---");
    if (context.paperData.account) {
      const acct = context.paperData.account as any;
      lines.push(`Account equity: ${acct.equity} | Cash: ${acct.cashBalance} | Status: ${acct.status}`);
    }
    if (context.paperData.openPositions?.length) {
      lines.push(`Open positions: ${context.paperData.openPositions.length}`);
    }
    if (context.paperData.alerts?.length) {
      lines.push(`Recent alerts: ${context.paperData.alerts.length}`);
    }
    lines.push("");
  }

  if (context.benchmarkData?.benchmarks?.length) {
    lines.push("--- BENCHMARKS ---");
    const names = context.benchmarkData.benchmarks.map((b: any) => b.name).join(", ");
    lines.push(`Available benchmarks: ${names}`);
    lines.push("");
  }

  if (context.recommendationData?.active?.length) {
    lines.push("--- ACTIVE RECOMMENDATIONS ---");
    context.recommendationData.active.slice(0, 5).forEach((r: any) => {
      lines.push(`[${r.priority?.toUpperCase() ?? "MED"}] ${r.title}: ${r.description}`);
    });
    lines.push("");
  }

  lines.push("=== END CONTEXT ===");
  return lines.join("\n");
}

function formatObject(obj: Record<string, unknown>, keys: string[]): string {
  return keys
    .filter((k) => obj[k] !== undefined && obj[k] !== null)
    .map((k) => `  ${k}: ${obj[k]}`)
    .join("\n");
}
