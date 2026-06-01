import { AiProviderFactory } from "./ai-provider-factory";
import { buildContext, formatContextAsPrompt } from "./ai-context-builder";
import {
  createConversation,
  getConversation,
  createQuery,
  createContextSnapshot,
  incrementConversationTokens,
  getQueryTurnCount,
  listQueriesForConversation,
  recordUsageMetric,
  writeAiAuditLog,
} from "./ai-db";
import type {
  ChatRequest,
  ChatResponse,
  ContextDomain,
  LlmMessage,
} from "./ai-types";
import { logger } from "../lib/logger";

/**
 * AI Chat Service — handles conversational Q&A with the platform's AI assistant.
 *
 * Each chat request:
 * 1. Resolves or creates a conversation session
 * 2. Builds a context snapshot from all requested platform data domains
 * 3. Constructs conversation history + system prompt + new question
 * 4. Calls the configured LLM provider
 * 5. Persists the query, context snapshot, usage metrics, and audit log entry
 * 6. Returns the response
 *
 * SAFETY: The system prompt explicitly instructs the LLM that it is ADVISORY ONLY.
 * It cannot execute trades, approve/reject orders, or override risk controls.
 */

const SYSTEM_PROMPT = `You are the QuantForge AI Research Assistant — an advisory-only analytical assistant for a systematic trading platform.

YOUR ROLE:
- Explain portfolio performance in plain English
- Explain risk events, circuit breakers, and drawdown behavior
- Summarize strategy characteristics and performance
- Describe diversification, concentration, and allocation patterns
- Compare strategies or portfolios descriptively
- Interpret health scores and analytical metrics
- Generate structured reports based on stored platform data

STRICT BOUNDARIES — YOU MUST NEVER:
- Execute or suggest specific trades
- Recommend position entries or exits
- Recommend position sizing or leverage amounts
- Override, bypass, or comment on how to avoid risk controls
- Claim to predict future prices or returns
- Provide investment advice or guarantee outcomes
- Act autonomously — you are advisory only

TONE: Professional, clear, and data-driven. Explain the "why" behind metrics.
Use markdown formatting for readability. When data is unavailable or stale, say so explicitly.

The human operator retains full control. All capital allocation and trading decisions are made exclusively by the human.`;

export async function processChat(req: ChatRequest): Promise<ChatResponse> {
  const provider = AiProviderFactory.getProvider();
  const domains: ContextDomain[] = req.domains ?? ["portfolio", "risk", "paper", "research", "benchmark", "health", "recommendations"];

  // 1. Resolve conversation
  let conversationId = req.conversationId;
  let conversation = conversationId ? await getConversation(conversationId) : undefined;

  if (!conversation) {
    conversation = await createConversation({
      title: req.question.slice(0, 100),
      actor: "user",
      status: "open",
      accountId: req.accountId,
      provider: provider.name,
      model: provider.defaultModel,
      contextDomains: domains,
    });
    conversationId = conversation.id;
  } else {
    conversationId = conversation.id;
  }

  // 2. Build context snapshot
  const context = await buildContext({ accountId: req.accountId, domains });
  const contextText = formatContextAsPrompt(context);

  const contextSnapshot = await createContextSnapshot({
    accountId: req.accountId,
    domains,
    portfolioData: context.portfolioData ?? null,
    riskData: context.riskData ?? null,
    paperData: context.paperData ?? null,
    researchData: context.researchData ?? null,
    benchmarkData: context.benchmarkData ?? null,
    healthData: context.healthData ?? null,
    recommendationData: context.recommendationData ?? null,
    dataPointCount: String(domains.length),
    contextSizeChars: String(context.contextSizeChars),
  });

  // 3. Build conversation history (last 10 turns for context window efficiency)
  const history = await listQueriesForConversation(conversationId);
  const turnCount = history.length;

  const messages: LlmMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: contextText },
  ];

  // Include recent history (last 6 turns = 3 Q&A pairs)
  const recentHistory = history.slice(-6);
  for (const pastQuery of recentHistory) {
    messages.push({ role: "user", content: pastQuery.prompt });
    if (pastQuery.response) {
      messages.push({ role: "assistant", content: pastQuery.response });
    }
  }

  messages.push({ role: "user", content: req.question });

  // 4. Call LLM provider
  const start = Date.now();
  let llmResponse: Awaited<ReturnType<typeof provider.complete>>;
  let queryStatus: "success" | "failure" = "success";
  let errorMessage: string | undefined;

  try {
    llmResponse = await provider.complete(messages, {
      maxTokens: 1500,
      temperature: 0.3,
    });
  } catch (err) {
    queryStatus = "failure";
    errorMessage = String(err);
    logger.error({ err, conversationId }, "LLM provider error in chat");

    // Record audit log even on failure
    await writeAiAuditLog({
      actor: "user",
      action: "chat.query",
      accountId: req.accountId,
      conversationId,
      promptSummary: req.question.slice(0, 200),
      promptFull: req.question,
      contextDomains: domains,
      provider: provider.name,
      model: provider.defaultModel,
      promptTokens: 0,
      completionTokens: 0,
      result: "failure",
      errorMessage,
    });

    throw new Error(`AI provider error: ${errorMessage}`);
  }

  // 5. Persist query record
  const query = await createQuery({
    conversationId,
    turnIndex: turnCount + 1,
    prompt: req.question,
    response: llmResponse.content,
    contextSnapshotId: contextSnapshot.id,
    provider: provider.name,
    model: llmResponse.model,
    promptTokens: llmResponse.usage.promptTokens,
    completionTokens: llmResponse.usage.completionTokens,
    totalTokens: llmResponse.usage.totalTokens,
    latencyMs: llmResponse.latencyMs,
    status: queryStatus,
    errorMessage,
  });

  // 6. Update conversation token counts
  await incrementConversationTokens(
    conversationId,
    llmResponse.usage.promptTokens,
    llmResponse.usage.completionTokens,
  );

  // 7. Record usage metric
  await recordUsageMetric({
    provider: provider.name,
    model: llmResponse.model,
    operationType: "chat",
    conversationId,
    queryId: query.id,
    promptTokens: llmResponse.usage.promptTokens,
    completionTokens: llmResponse.usage.completionTokens,
    totalTokens: llmResponse.usage.totalTokens,
    estimatedCostUsd: String(llmResponse.usage.estimatedCostUsd ?? 0),
    latencyMs: llmResponse.latencyMs,
    status: queryStatus,
  });

  // 8. Audit log
  await writeAiAuditLog({
    actor: "user",
    action: "chat.query",
    accountId: req.accountId,
    conversationId,
    promptSummary: req.question.slice(0, 200),
    promptFull: req.question,
    responseSummary: llmResponse.content.slice(0, 300),
    contextDomains: domains,
    provider: provider.name,
    model: llmResponse.model,
    promptTokens: llmResponse.usage.promptTokens,
    completionTokens: llmResponse.usage.completionTokens,
    latencyMs: llmResponse.latencyMs,
    result: "success",
  });

  return {
    conversationId,
    queryId: query.id,
    answer: llmResponse.content,
    provider: provider.name,
    model: llmResponse.model,
    usage: llmResponse.usage,
    contextDomains: domains,
  };
}
