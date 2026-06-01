import { Router, type IRouter } from "express";
import { buildContext } from "../../services/ai-context-builder";
import { getContextSnapshot } from "../../services/ai-db";
import type { ContextDomain } from "../../services/ai-types";

const router: IRouter = Router();

const VALID_DOMAINS: ContextDomain[] = [
  "portfolio", "risk", "paper", "research", "benchmark", "health", "recommendations",
];

/**
 * GET /v1/ai/context
 * Build and return a fresh context snapshot from current platform data.
 * This endpoint is useful for previewing what data the AI will receive before making a query.
 *
 * Note: Does NOT persist the snapshot — use POST /v1/ai/chat to generate and persist.
 */
router.get("/ai/context", async (req, res) => {
  const { accountId, domains: domainsParam } = req.query as Record<string, string | undefined>;

  let domains: ContextDomain[] | undefined;
  if (domainsParam) {
    const requested = domainsParam.split(",").map((d) => d.trim()) as ContextDomain[];
    const invalid = requested.filter((d) => !VALID_DOMAINS.includes(d));
    if (invalid.length > 0) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `Invalid domains: ${invalid.join(", ")}. Valid: ${VALID_DOMAINS.join(", ")}`,
        },
      });
      return;
    }
    domains = requested;
  }

  try {
    const context = await buildContext({ accountId, domains });
    res.json({ data: context });
  } catch (err) {
    req.log?.error({ err }, "Context build error");
    res.status(500).json({ error: { code: "SERVER_ERROR", message: String(err) } });
  }
});

/**
 * GET /v1/ai/context/:id
 * Retrieve a previously stored context snapshot by ID.
 */
router.get("/ai/context/:id", async (req, res) => {
  const snapshot = await getContextSnapshot(req.params.id);
  if (!snapshot) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Context snapshot not found" } });
    return;
  }
  res.json({ data: snapshot });
});

export default router;
