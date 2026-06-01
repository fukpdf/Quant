import type { ILlmProvider, LlmMessage, LlmRequestOptions, LlmResponse } from "../ai-types";
import { logger } from "../../lib/logger";

/**
 * OpenAiLlmProvider — adapter for the OpenAI Chat Completions API.
 *
 * Requires: OPENAI_API_KEY environment variable.
 * Default model: gpt-4o-mini (cost-efficient for advisory text generation).
 *
 * The provider uses the OpenAI REST API directly without the SDK to avoid
 * adding a heavy dependency. The fetch call is standard JSON/REST.
 */
export class OpenAiLlmProvider implements ILlmProvider {
  readonly name = "openai" as const;
  readonly defaultModel = "gpt-4o-mini";

  private readonly apiKey: string;
  private readonly baseUrl = "https://api.openai.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse> {
    const start = Date.now();
    const model = options?.model ?? this.defaultModel;

    const body = {
      model,
      messages,
      max_tokens: options?.maxTokens ?? 1500,
      temperature: options?.temperature ?? 0.3,
    };

    let raw: Response;
    try {
      raw = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      logger.error({ err }, "OpenAI network error");
      throw new Error(`OpenAI network error: ${String(err)}`);
    }

    if (!raw.ok) {
      const text = await raw.text().catch(() => "");
      throw new Error(`OpenAI API error ${raw.status}: ${text}`);
    }

    const json = (await raw.json()) as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model: string;
    };

    const content = json.choices[0]?.message?.content ?? "";
    const usage = json.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      content,
      model: json.model ?? model,
      provider: "openai",
      usage: {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        estimatedCostUsd: this.estimateCost(model, usage.prompt_tokens, usage.completion_tokens),
      },
      latencyMs: Date.now() - start,
    };
  }

  private estimateCost(model: string, promptTokens: number, completionTokens: number): number {
    // Approximate pricing per 1M tokens (as of mid-2025 — update as prices change)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      "gpt-4o": { prompt: 2.5, completion: 10.0 },
      "gpt-4o-mini": { prompt: 0.15, completion: 0.6 },
      "gpt-4-turbo": { prompt: 10.0, completion: 30.0 },
      "gpt-3.5-turbo": { prompt: 0.5, completion: 1.5 },
    };
    const p = pricing[model] ?? { prompt: 0.5, completion: 1.5 };
    return (promptTokens * p.prompt + completionTokens * p.completion) / 1_000_000;
  }
}
