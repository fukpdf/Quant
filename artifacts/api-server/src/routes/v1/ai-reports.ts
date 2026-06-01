import { Router, type IRouter } from "express";
import { generateReport } from "../../services/ai-report-engine";
import { listReports, getReport } from "../../services/ai-db";
import type { ReportType } from "../../services/ai-types";

const router: IRouter = Router();

const VALID_REPORT_TYPES: ReportType[] = [
  "portfolio", "strategy", "risk", "performance", "benchmark",
  "health", "diversification", "allocation", "daily", "weekly", "monthly", "research",
];

/**
 * POST /v1/ai/report
 * Generate an AI analytical report from stored platform data.
 * Reports are persisted and retrievable via GET /v1/ai/reports/:id.
 */
router.post("/ai/report", async (req, res) => {
  const { reportType, accountId, strategyName, period, periodStart, periodEnd, domains } =
    req.body as Record<string, unknown>;

  if (!reportType || typeof reportType !== "string") {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "reportType is required" } });
    return;
  }

  if (!VALID_REPORT_TYPES.includes(reportType as ReportType)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `reportType must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
      },
    });
    return;
  }

  try {
    const result = await generateReport({
      reportType: reportType as ReportType,
      accountId: typeof accountId === "string" ? accountId : undefined,
      strategyName: typeof strategyName === "string" ? strategyName : undefined,
      period: typeof period === "string" ? (period as "daily" | "weekly" | "monthly" | "custom") : undefined,
      periodStart: typeof periodStart === "string" ? periodStart : undefined,
      periodEnd: typeof periodEnd === "string" ? periodEnd : undefined,
      domains: Array.isArray(domains) ? domains : undefined,
    });

    res.status(201).json({ data: result });
  } catch (err) {
    req.log?.error({ err }, "Report generation error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

/**
 * GET /v1/ai/reports
 * List generated reports.
 */
router.get("/ai/reports", async (req, res) => {
  const { accountId, reportType, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 50;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–200" } });
    return;
  }

  const reports = await listReports({ accountId, reportType, limit: parsedLimit });
  res.json({ data: reports, total: reports.length });
});

/**
 * GET /v1/ai/reports/:id
 * Get a specific report by ID including full content.
 */
router.get("/ai/reports/:id", async (req, res) => {
  const report = await getReport(req.params.id);
  if (!report) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Report not found" } });
    return;
  }
  res.json({ data: report });
});

export default router;
