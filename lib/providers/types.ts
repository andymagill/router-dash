/**
 * Provider-agnostic core types and identity helpers.
 *
 * RouterDash treats OpenRouter, Groq, and Cerebras as first-class providers. A
 * model is identified by a stable composite key `${provider}:${modelId}` so
 * the same base model ID coming from two different providers never collides.
 */

export type ProviderId = "openrouter" | "groq" | "cerebras"

export const PROVIDER_IDS: readonly ProviderId[] = [
  "openrouter",
  "groq",
  "cerebras",
]

export function isProviderId(value: unknown): value is ProviderId {
  return (
    typeof value === "string" &&
    (PROVIDER_IDS as readonly string[]).includes(value)
  )
}

/**
 * Display names shared across the adapters, error summaries, and other code
 * that cannot import `ADAPTERS` from "./index" (an import cycle: index ->
 * openrouter/groq/cerebras -> errors -> index).
 */
export const PROVIDER_LABELS: Record<ProviderId, string> = {
  openrouter: "OpenRouter",
  groq: "Groq",
  cerebras: "Cerebras",
}

// ---------------------------------------------------------------------------
// Shared request/response shapes (OpenAI-compatible)
// ---------------------------------------------------------------------------

export interface ORUsage {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/** Generation parameters applied to every model in a run. */
export interface RunParams {
  systemPrompt: string
  temperature: number
  topP: number
  maxTokens: number
}

// ---------------------------------------------------------------------------
// Unified model shape
// ---------------------------------------------------------------------------

/**
 * A normalized, provider-agnostic model description used across the picker,
 * chips, and result cards. Only metadata that is *actually known* is
 * populated; unknown fields stay undefined and are surfaced honestly in the UI
 * (we never fabricate pricing/free/modality data a provider did not give us).
 */
export interface UnifiedModel {
  /** Composite identity: `${provider}:${modelId}`. Stable + globally unique. */
  key: string
  provider: ProviderId
  /** Provider-native model ID, e.g. "openai/gpt-4o" or "llama-3.3-70b-versatile". */
  modelId: string
  /** Display name. */
  name: string
  /** Brand/vendor slug used for the colored monogram (openai, meta, ...). */
  vendor: string
  /** Owner string as reported by the provider, when available. */
  owner?: string

  contextLength?: number
  contextKnown: boolean

  /** Per-token USD prices as strings (OpenRouter style). Undefined = unknown. */
  promptPrice?: string
  completionPrice?: string
  pricingKnown: boolean
  /** True only when positively known to be free (OpenRouter $0/$0). */
  isFree: boolean

  inputModalities?: string[]
  supportedParameters?: string[]

  preview?: boolean
  deprecated?: boolean
}

export interface CompletionOutcome {
  content: string
  usage: ORUsage | null
}

/**
 * A provider adapter isolates provider-specific catalog + completion behavior
 * behind a common surface. Keys are passed in explicitly and never read from
 * storage here, keeping adapters pure and unit-testable.
 */
export interface ProviderAdapter {
  id: ProviderId
  label: string
  /** Where users create a key. */
  keyUrl: string
  keyPlaceholder: string
  /** Human hint shown near the key field, e.g. "starts with sk-or-". */
  keyHint: string
  /** OpenRouter's catalog is public; Groq's requires the user's key. */
  requiresKeyForCatalog: boolean
  fetchCatalog(apiKey: string, signal?: AbortSignal): Promise<UnifiedModel[]>
  runCompletion(
    apiKey: string,
    model: UnifiedModel,
    prompt: string,
    params: RunParams,
    signal?: AbortSignal,
  ): Promise<CompletionOutcome>
}

// ---------------------------------------------------------------------------
// Identity helpers
// ---------------------------------------------------------------------------

/** Build a composite model key. */
export function makeModelKey(provider: ProviderId, modelId: string): string {
  return `${provider}:${modelId}`
}

/**
 * Parse a composite key into provider + native model ID. A key without a known
 * provider prefix is treated as a legacy OpenRouter id (backwards compat with
 * benchmarks saved before Groq/Cerebras support existed).
 */
export function parseModelKey(key: string): {
  provider: ProviderId
  modelId: string
} {
  const idx = key.indexOf(":")
  if (idx > 0) {
    const prefix = key.slice(0, idx)
    if (isProviderId(prefix)) {
      return { provider: prefix, modelId: key.slice(idx + 1) }
    }
  }
  return { provider: "openrouter", modelId: key }
}

/**
 * Normalize any stored identifier to a composite key. Bare/legacy OpenRouter
 * IDs (no known provider prefix) become `openrouter:<id>`.
 */
export function normalizeStoredKey(stored: string): string {
  const { provider, modelId } = parseModelKey(stored)
  return makeModelKey(provider, modelId)
}

// ---------------------------------------------------------------------------
// Generic metadata helpers (work for any provider)
// ---------------------------------------------------------------------------

/** When metadata is missing we assume support to avoid false warnings. */
export function supportsParam(model: UnifiedModel, param: string): boolean {
  if (!model.supportedParameters || model.supportedParameters.length === 0) {
    return true
  }
  return model.supportedParameters.includes(param)
}

export const LONG_CONTEXT_THRESHOLD = 128_000

export function isLongContext(
  model: UnifiedModel,
  threshold = LONG_CONTEXT_THRESHOLD,
): boolean {
  return (model.contextLength ?? 0) >= threshold
}

/** Estimated USD cost for a completion. Returns 0 when pricing is unknown. */
export function estimateCost(
  model: UnifiedModel,
  usage: ORUsage | null,
): number {
  if (!usage || !model.pricingKnown) return 0
  const promptPrice = Number(model.promptPrice) || 0
  const completionPrice = Number(model.completionPrice) || 0
  return (
    usage.prompt_tokens * promptPrice +
    usage.completion_tokens * completionPrice
  )
}
