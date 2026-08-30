/**
 * Backwards-compatibility surface for the original single-provider module.
 *
 * The provider-aware core now lives in `@/lib/providers`. This file re-exports
 * the shared types and keeps the small "vendor" helpers (monogram brand slug +
 * label + token estimate) that UI components import directly.
 */

export type { RunParams, ORUsage, ChatMessage } from "@/lib/providers/types"
export type {
  ORModel,
  ORPricing,
  ORArchitecture,
  ORTopProvider,
} from "@/lib/providers/openrouter"

/** A friendly, capitalized label for a vendor/brand slug. */
export function providerLabel(slug: string): string {
  const map: Record<string, string> = {
    openai: "OpenAI",
    anthropic: "Anthropic",
    google: "Google",
    "meta-llama": "Meta",
    meta: "Meta",
    mistralai: "Mistral",
    mistral: "Mistral",
    "x-ai": "xAI",
    deepseek: "DeepSeek",
    qwen: "Qwen",
    cohere: "Cohere",
    perplexity: "Perplexity",
    microsoft: "Microsoft",
    nvidia: "NVIDIA",
    amazon: "Amazon",
    moonshotai: "Moonshot",
    groq: "Groq",
    cerebras: "Cerebras",
  }
  return map[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

/** Parse the vendor slug out of a model id, e.g. "anthropic/claude" -> "anthropic". */
export function providerOf(model: { id: string }): string {
  return model.id.split("/")[0] ?? "unknown"
}

/** Rough token estimate (~4 chars per token) for the prompt hint. */
export function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}
