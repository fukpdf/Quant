import { Router } from "express";
import { z } from "zod/v4";
import {
  dispatchResearchJob,
  executeResearchJob,
  listAiResearchJobs,
  listAiResearchFindings,
  acknowledgeFinding,
  getAiResearchJobById,
} from "../../services/ai-optimization-assistant";
import type { ResearchJobType, ResearchJobPriority } from "../../services/intelligence-types";

/**
 * intelligence-research.ts — AI Research Jobs & Findings endpoints.
 *
 * POST   /v1/intelligence/research/jobs              — dispatch research job
 * GET    /v1/intelligence/research/jobs              — list jobs
 * GET    /v1/intelligence/research/jobs/:id          — get job detail
 * POST   /v1/intelligence/research/jobs/:id/execute  — execute job immediately
 * GET    /v1/intelligence/research/findings          — list findings
 * PATCH  /v1/intelligence/research/findings/:id/acknowledge — acknowledge finding
 */

const router = Router();

const DispatchJobSchema = z.object({
  jobType: z.enum([
    "strategy_analysis",
    "optimization_recommendation",
    "regime_adaptation",
    "parameter_suggestion",
    "overfitting_detection",
    "portfolio_review",
    "comparative_analysis",
  ]),
  strategyName: z.string().max(100).optional(),
  inputParameters: z.record(z.string(), z.unknown()).optional().default({}),
  priority: z.enum(["low", "medium", "high", "critical"]).optional().default("medium"),
  scheduledAt: z.string().datetime().optional(),
});

// POST /v1/intelligence/research/jobs
router.post("/intelligence/research/jobs", async (req, res) => {
  const parsed = DispatchJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", issues: parsed.error.issues });
  }

  const { jobType, strategyName, inputParameters, priority, scheduledAt } = parsed.data;

  try {
    const jobId = await dispatchResearchJob(
      jobType as ResearchJobType,
      strategyName,
      inputParameters as Record<string, unknown>,
      priority as ResearchJobPriority,
      scheduledAt ? new Date(scheduledAt) : undefined,
    );
    const job = await getAiResearchJobById(jobId);
    return res.status(201).json({ data: job });
  } catch (err) {
    req.log?.error({ err }, "Failed to dispatch research job");
    return res.status(500).json({ error: "Failed to dispatch research job" });
  }
});

// GET /v1/intelligence/research/jobs
router.get("/intelligence/research/jobs", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const jobType = typeof req.query.job_type === "string" ? req.query.job_type : undefined;
  const strategyName = typeof req.query.strategy_name === "string" ? req.query.strategy_name : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const jobs = await listAiResearchJobs({ status, jobType, strategyName, limit, offset });
    return res.json({ data: jobs, count: jobs.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list research jobs");
    return res.status(500).json({ error: "Failed to list research jobs" });
  }
});

// GET /v1/intelligence/research/jobs/:id
router.get("/intelligence/research/jobs/:id", async (req, res) => {
  try {
    const job = await getAiResearchJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "Research job not found" });
    return res.json({ data: job });
  } catch (err) {
    req.log?.error({ err }, "Failed to get research job");
    return res.status(500).json({ error: "Failed to get research job" });
  }
});

// POST /v1/intelligence/research/jobs/:id/execute
router.post("/intelligence/research/jobs/:id/execute", async (req, res) => {
  try {
    const job = await getAiResearchJobById(req.params.id);
    if (!job) return res.status(404).json({ error: "Research job not found" });
    if (job.status !== "pending") {
      return res.status(409).json({ error: `Job is in '${job.status}' state — only pending jobs can be executed` });
    }

    // Execute asynchronously, return 202
    setImmediate(() => executeResearchJob(req.params.id));
    return res.status(202).json({ message: "Job execution started", jobId: req.params.id });
  } catch (err) {
    req.log?.error({ err }, "Failed to execute research job");
    return res.status(500).json({ error: "Failed to execute research job" });
  }
});

// GET /v1/intelligence/research/findings
router.get("/intelligence/research/findings", async (req, res) => {
  const jobId = typeof req.query.job_id === "string" ? req.query.job_id : undefined;
  const strategyName = typeof req.query.strategy_name === "string" ? req.query.strategy_name : undefined;
  const findingType = typeof req.query.finding_type === "string" ? req.query.finding_type : undefined;
  const severity = typeof req.query.severity === "string" ? req.query.severity : undefined;
  const isAcknowledgedStr = req.query.is_acknowledged;
  const isAcknowledged =
    isAcknowledgedStr === "true" ? true : isAcknowledgedStr === "false" ? false : undefined;
  const limit = Math.min(parseInt(String(req.query.limit ?? "50")), 200);
  const offset = parseInt(String(req.query.offset ?? "0"));

  try {
    const findings = await listAiResearchFindings({
      jobId,
      strategyName,
      findingType,
      severity,
      isAcknowledged,
      limit,
      offset,
    });
    return res.json({ data: findings, count: findings.length });
  } catch (err) {
    req.log?.error({ err }, "Failed to list research findings");
    return res.status(500).json({ error: "Failed to list research findings" });
  }
});

// PATCH /v1/intelligence/research/findings/:id/acknowledge
router.patch("/intelligence/research/findings/:id/acknowledge", async (req, res) => {
  try {
    const finding = await acknowledgeFinding(req.params.id);
    if (!finding) return res.status(404).json({ error: "Finding not found" });
    return res.json({ data: finding });
  } catch (err) {
    req.log?.error({ err }, "Failed to acknowledge finding");
    return res.status(500).json({ error: "Failed to acknowledge finding" });
  }
});

export default router;
