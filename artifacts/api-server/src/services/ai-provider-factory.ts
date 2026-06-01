import type { ILlmProvider, LlmProviderName } from "./ai-types";
import { MockLlmProvider } from "./llm-providers/mock-provider";
import { OpenAiLlmProvider } from "./llm-providers/openai-provider";
import { AnthropicLlmProvider } from "./llm-providers/anthropic-provider";
import { GeminiLlmProvider } from "./llm-providers/gemini-provider";
import { logger } from "../lib/logger";

/**
 * AI Provider Factory — creates the active LLM provider based on environment configuration.
 *
 * Provider selection via AI_PROVIDER environment variable:
 *   openai    → requires OPENAI_API_KEY
 *   anthropic → requires ANTHROPIC_API_KEY
 *   gemini    → requires GEMINI_API_KEY
 *   mock      → no key required (default)
 *
 * Switching providers requires only an environment variable change — no application code changes.
 * This enforces the ADR-018 requirement: "Provider switching must require no application changes."
 *
 * If the configured provider is missing its API key, the factory falls back to the Mock provider
 * and logs a warning. This prevents the AI layer from crashing the server on misconfiguration.
 */
export class AiProviderFactory {
  private static instance: ILlmProvider | null = null;

  static getProvider(): ILlmProvider {
    if (this.instance) return this.instance;
    this.instance = this.createProvider();
    return this.instance;
  }

  /** Call this when the provider config changes (e.g. in tests) */
  static reset(): void {
    this.instance = null;
  }

  static getProviderName(): LlmProviderName {
    return this.getProvider().name;
  }

  private static createProvider(): ILlmProvider {
    const configured = (process.env["AI_PROVIDER"] ?? "mock").toLowerCase() as LlmProviderName;

    switch (configured) {
      case "openai": {
        const key = process.env["OPENAI_API_KEY"];
        if (!key) {
          logger.warn("AI_PROVIDER=openai but OPENAI_API_KEY is not set — falling back to mock provider");
          return new MockLlmProvider();
        }
        logger.info("AI provider: openai");
        return new OpenAiLlmProvider(key);
      }

      case "anthropic": {
        const key = process.env["ANTHROPIC_API_KEY"];
        if (!key) {
          logger.warn("AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set — falling back to mock provider");
          return new MockLlmProvider();
        }
        logger.info("AI provider: anthropic");
        return new AnthropicLlmProvider(key);
      }

      case "gemini": {
        const key = process.env["GEMINI_API_KEY"];
        if (!key) {
          logger.warn("AI_PROVIDER=gemini but GEMINI_API_KEY is not set — falling back to mock provider");
          return new MockLlmProvider();
        }
        logger.info("AI provider: gemini");
        return new GeminiLlmProvider(key);
      }

      case "mock":
      default: {
        if (configured !== "mock") {
          logger.warn({ configured }, "Unknown AI_PROVIDER value — falling back to mock provider");
        } else {
          logger.info("AI provider: mock (no real LLM calls)");
        }
        return new MockLlmProvider();
      }
    }
  }
}
