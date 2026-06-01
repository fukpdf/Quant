import { Router, type IRouter } from "express";
import { processChat } from "../../services/ai-chat-service";
import { listConversations, listQueriesForConversation } from "../../services/ai-db";

const router: IRouter = Router();

/**
 * POST /v1/ai/chat
 * Submit a question to the AI research assistant.
 * Returns the AI's response along with conversation ID, model info, and token usage.
 *
 * SAFETY: The AI is advisory only. It cannot execute trades, approve orders,
 * override risk controls, or control capital. All responses are explanatory.
 */
router.post("/ai/chat", async (req, res) => {
  const { question, conversationId, accountId, domains } = req.body as Record<string, unknown>;

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "question is required and must be a non-empty string" } });
    return;
  }

  if (question.length > 5000) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "question must be under 5000 characters" } });
    return;
  }

  try {
    const result = await processChat({
      question: question.trim(),
      conversationId: typeof conversationId === "string" ? conversationId : undefined,
      accountId: typeof accountId === "string" ? accountId : undefined,
      domains: Array.isArray(domains) ? domains : undefined,
    });

    res.status(200).json({ data: result });
  } catch (err) {
    req.log?.error({ err }, "AI chat error");
    res.status(500).json({ error: { code: "AI_ERROR", message: String(err) } });
  }
});

/**
 * GET /v1/ai/conversations
 * List AI conversation sessions.
 */
router.get("/ai/conversations", async (req, res) => {
  const { accountId, status, limit } = req.query as Record<string, string | undefined>;

  const parsedLimit = limit ? parseInt(limit, 10) : 50;
  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 200) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "limit must be 1–200" } });
    return;
  }

  const conversations = await listConversations({ accountId, status, limit: parsedLimit });
  res.json({ data: conversations, total: conversations.length });
});

/**
 * GET /v1/ai/conversations/:id/queries
 * List all queries within a conversation session.
 */
router.get("/ai/conversations/:id/queries", async (req, res) => {
  const { id } = req.params;
  const queries = await listQueriesForConversation(id);
  res.json({ data: queries, total: queries.length });
});

export default router;
