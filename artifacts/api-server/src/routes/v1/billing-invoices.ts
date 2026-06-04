import { Router } from "express";
import { requireAuth } from "../../middleware/auth-middleware";
import { getOrgInvoices, getOrgInvoice } from "../../services/invoice-service";

const router = Router();

// GET /billing/invoices
router.get("/billing/invoices", requireAuth, async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }

  const limit  = Math.min(Number(req.query["limit"]  ?? 20), 100);
  const offset = Number(req.query["offset"] ?? 0);
  const sync   = req.query["sync"] === "true";

  const invoices = await getOrgInvoices(orgId, { limit, offset, sync });
  res.json({ invoices });
});

// GET /billing/invoices/:id
router.get("/billing/invoices/:id", requireAuth, async (req, res) => {
  const orgId = req.auth!.organizationId ?? req.tenant?.organizationId;
  if (!orgId) {
    res.status(400).json({ error: { code: "NO_ORG", message: "Organization context required" } });
    return;
  }
  const { id } = req.params as Record<string, string>;

  const invoice = await getOrgInvoice(orgId, id);
  if (!invoice) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Invoice not found" } });
    return;
  }
  res.json({ invoice });
});

export default router;
