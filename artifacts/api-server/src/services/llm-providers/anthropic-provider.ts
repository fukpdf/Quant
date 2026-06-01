import type { ILlmProvider, LlmMessage, LlmRequestOptions, LlmResponse } from "../ai-types";
import { logger } from "../../lib/logger";

/**
 * AnthropicLlmProvider — adapter for the Anthropic Messages API.
 *
 * Requires: ANTHROPIC_API_KEY environment variable.
 * Default model: claude-3-5-haiku-latest (cost-efficient for advisory text).
 *
 * Anthropic's API separates "system" messages from "messages" — this adapter
 * handles the conversion automatically so callers use the unified LlmMessage format.
 */
export class AnthropicLlmProvider implements ILlmProvider {
  readonly name = "anthropic" as const;
  readonly defaultModel = "claude-3-5-haiku-latest";

  private readonly apiKey: string;
  private readonly baseUrl = "https://api.anthropic.com/v1";
  private readonly apiVersion = "2023-06-01";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse> {
    const start = Date.now();
    const model = options?.model ?? this.defaultModel;

    // Extract system message — Anthropic puts it at the top level
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const chatMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: options?.maxTokens ?? 1500,
      messages: chatMessages,
    };
    if (systemMsg) body["system"] = systemMsg;
    if (options?.temperature !== undefined) body["temperature"] = options.temperature;

    let raw: Response;
    try {
      raw = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      logger.error({ err }, "Anthropic network error");
      throw new Error(`Anthropic network error: ${String(err)}`);
    }

    if (!raw.ok) {
      const text = await raw.text().catch(() => "");
      throw new Error(`Anthropic API error ${raw.status}: ${text}`);
    }

    const json = (await raw.json()) as {
      content: { type: string; text: string }[];
      usage: { input_tokens: number; output_tokens: number };
      model: string;
    };

    const content = json.content.find((c) => c.type === "text")?.text ?? "";
    const usage = json.usage ?? { input_tokens: 0, output_tokens: 0 };

    return {
      content,
      model: json.model ?? model,
      provider: "anthropic",
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        estimatedCostUsd: this.estimateCost(model, usage.input_tokens, usage.output_tokens),
      },
      latencyMs: Date.now() - start,
    };
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Approximate pricing per 1M tokens (as of mid-2025)
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-3-5-haiku-latest": { input: 0.8, output: 4.0 },
      "claude-3-5-sonnet-latest": { input: 3.0, output: 15.0 },
      "claude-3-opus-latest": { input: 15.0, output: 75.0 },
    };
    const p = pricing[model] ?? { input: 3.0, output: 15.0 };
    return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  }
}
