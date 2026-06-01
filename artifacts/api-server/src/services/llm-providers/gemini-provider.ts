import type { ILlmProvider, LlmMessage, LlmRequestOptions, LlmResponse } from "../ai-types";
import { logger } from "../../lib/logger";

/**
 * GeminiLlmProvider — adapter for the Google Gemini generateContent API.
 *
 * Requires: GEMINI_API_KEY environment variable.
 * Default model: gemini-1.5-flash (cost-efficient for advisory text generation).
 *
 * Gemini uses a different message format ("parts" and "role=model" for assistant).
 * This adapter converts from the unified LlmMessage format.
 */
export class GeminiLlmProvider implements ILlmProvider {
  readonly name = "gemini" as const;
  readonly defaultModel = "gemini-1.5-flash";

  private readonly apiKey: string;
  private readonly baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async complete(messages: LlmMessage[], options?: LlmRequestOptions): Promise<LlmResponse> {
    const start = Date.now();
    const model = options?.model ?? this.defaultModel;

    // Gemini separates system instructions from conversation
    const systemMsg = messages.find((m) => m.role === "system")?.content;
    const chatMessages = messages.filter((m) => m.role !== "system");

    const contents = chatMessages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 1500,
        temperature: options?.temperature ?? 0.3,
      },
    };

    if (systemMsg) {
      body["systemInstruction"] = { parts: [{ text: systemMsg }] };
    }

    let raw: Response;
    try {
      raw = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    } catch (err) {
      logger.error({ err }, "Gemini network error");
      throw new Error(`Gemini network error: ${String(err)}`);
    }

    if (!raw.ok) {
      const text = await raw.text().catch(() => "");
      throw new Error(`Gemini API error ${raw.status}: ${text}`);
    }

    const json = (await raw.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
      usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number; totalTokenCount: number };
    };

    const content = json.candidates[0]?.content?.parts?.map((p) => p.text).join("") ?? "";
    const usage = json.usageMetadata;

    const promptTokens = usage?.promptTokenCount ?? 0;
    const completionTokens = usage?.candidatesTokenCount ?? 0;

    return {
      content,
      model,
      provider: "gemini",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: usage?.totalTokenCount ?? promptTokens + completionTokens,
        estimatedCostUsd: this.estimateCost(model, promptTokens, completionTokens),
      },
      latencyMs: Date.now() - start,
    };
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // Approximate pricing per 1M tokens (as of mid-2025)
    const pricing: Record<string, { input: number; output: number }> = {
      "gemini-1.5-flash": { input: 0.075, output: 0.3 },
      "gemini-1.5-pro": { input: 1.25, output: 5.0 },
      "gemini-2.0-flash": { input: 0.1, output: 0.4 },
    };
    const p = pricing[model] ?? { input: 0.5, output: 1.5 };
    return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
  }
}
