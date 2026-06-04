import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { requirePermission } from "../../middleware/rbac-middleware";
import { getOrgUsageSummary, recordUsage } from "../../services/usage-service";
import type { UsageResourceType } from "../../services/billing-types";

const router = Router();

// GET /billing/usage — current period usage summary for org
router.get("/billing/usage", requireAuth, async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const summary = await getOrgUsageSummary(orgId);
  res.json(summary);
});

// POST /billing/usage/record — manual usage record (for internal services)
router.post("/billing/usage/record", requireAuth, requirePermission("operations:admin"), async (req, res) => {
  const { organizationId, resourceType, quantity, metadata } = req.body as {
    organizationId?: string;
    resourceType?:   UsageResourceType;
    quantity?:       number;
    metadata?:       Record<string, unknown>;
  };

  const orgId = organizationId ?? req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization ID required" } });
    return;
  }
  if (!resourceType) {
    res.status(400).json({ error: { code: "MISSING_RESOURCE", message: "resourceType is required" } });
    return;
  }

  await recordUsage({
    organizationId: orgId,
    userId:         req.auth?.userId,
    resourceType,
    quantity:       quantity ?? 1,
    metadata,
  });

  res.json({ recorded: true });
});

export default router;
