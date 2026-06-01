import { Router, type IRouter } from "express";
import { z } from "zod";
import {
  createPaperAccount,
  listPaperAccounts,
  getPaperAccount,
  getPaperPortfolio,
} from "../../services/paper-accounts-db";

const router: IRouter = Router();

const CreateAccountSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  initialCapital: z.number().positive().min(100).max(100_000_000),
});

/**
 * POST /v1/paper/accounts
 * Create a new virtual paper trading account.
 */
router.post("/paper/accounts", async (req, res) => {
  const parse = CreateAccountSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parse.error.message } });
    return;
  }

  const account = await createPaperAccount(parse.data);

  res.status(201).json({ account });
});

/**
 * GET /v1/paper/accounts
 * List all paper trading accounts, optionally filtered by status.
 */
router.get("/paper/accounts", async (req, res) => {
  const status = req.query["status"] as string | undefined;
  const VALID_STATUSES = ["active", "paused", "closed"];

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
      },
    });
    return;
  }

  const accounts = await listPaperAccounts(status);
  res.json({ data: accounts, total: accounts.length });
});

/**
 * GET /v1/paper/accounts/:id
 * Get a specific paper account with its portfolio summary.
 */
router.get("/paper/accounts/:id", async (req, res) => {
  const { id } = req.params;

  const account = await getPaperAccount(id);
  if (!account) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: `Account not found: ${id}` } });
    return;
  }

  const portfolio = await getPaperPortfolio(id);

  res.json({ account, portfolio });
});

export default router;
