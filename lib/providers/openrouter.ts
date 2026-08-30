/**
 * OpenRouter provider adapter.
 *
 * OpenRouter's `/models` catalog is public (no key required), so discovery
 * works before a key is entered. Completions use the user's own key and go
 * directly to OpenRouter from the browser.
 */

import type {
  CompletionOutcome,
  ProviderAdapter,
  RunParams,
  UnifiedModel,
} from "./types"
import { makeModelKey, PROVIDER_LABELS, supportsParam } from "./types"
import { isChatCompatibleId, vendorSlugFromId } from "./compat"
import { postChatCompletion } from "./openai-compat"
import { providerErrorFromResponse, providerErrorFromThrown } from "./errors"

export const OPENROUTER_BASE = "https://openrouter.ai/api/v1"

// --- Raw OpenRouter catalog shapes (retained for typed normalization) -------

export interface ORPricing {
  prompt: string
  completion: string
  request?: string
  image?: string
}

export interface ORArchitecture {
  modality?: string
  input_modalities?: string[]
  output_modalities?: string[]
  tokenizer?: string
}

export interface ORTopProvider {
  context_length?: number
  max_completion_tokens?: number
  is_moderated?: boolean
}

export interface ORModel {
  id: string
  name: string
  description?: string
  created?: number
  context_length?: number
  architecture?: ORArchitecture
  pricing?: ORPricing
  top_provider?: ORTopProvider
  supported_parameters?: string[]
}

/** Keep only models that can actually run through chat-completions. */
function isCompatible(model: ORModel): boolean {
  if (!isChatCompatibleId(model.id)) return false
  // If output modalities are known and don't include text, it can't produce a
  // text benchmark response (e.g. image-only generation models).
  const out = model.architecture?.output_modalities
  if (out && out.length > 0 && !out.includes("text")) return false
  return true
}

export function normalizeOpenRouterModel(model: ORModel): UnifiedModel {
  const contextLength =
    model.context_length ?? model.top_provider?.context_length
  const pricingKnown = Boolean(model.pricing)
  const isFree =
    pricingKnown &&
    Number(model.pricing?.prompt) === 0 &&
    Number(model.pricing?.completion) === 0

  return {
    key: makeModelKey("openrouter", model.id),
    provider: "openrouter",
    modelId: model.id,
    name: model.name || model.id,
    vendor: vendorSlugFromId(model.id),
    owner: vendorSlugFromId(model.id),
    contextLength: contextLength ?? undefined,
    contextKnown: contextLength != null,
    promptPrice: model.pricing?.prompt,
    completionPrice: model.pricing?.completion,
    pricingKnown,
    isFree,
    inputModalities: model.architecture?.input_modalities,
    supportedParameters: model.supported_parameters,
  }
}

async function fetchCatalog(
  _apiKey: string,
  signal?: AbortSignal,
): Promise<UnifiedModel[]> {
  let res: Response
  try {
    res = await fetch(`${OPENROUTER_BASE}/models`, {
      headers: { Accept: "application/json" },
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw providerErrorFromThrown("openrouter", err)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw providerErrorFromResponse({
      provider: "openrouter",
      status: res.status,
      rawMessage: text,
    })
  }
  const json = await res.json()
  const data: ORModel[] = json?.data ?? []
  return data.filter(isCompatible).map(normalizeOpenRouterModel)
}

async function runCompletion(
  apiKey: string,
  model: UnifiedModel,
  prompt: string,
  params: RunParams,
  signal?: AbortSignal,
): Promise<CompletionOutcome> {
  const messages = []
  if (params.systemPrompt.trim()) {
    messages.push({ role: "system" as const, content: params.systemPrompt })
  }
  messages.push({ role: "user" as const, content: prompt })

  const body: Record<string, unknown> = { max_tokens: params.maxTokens }
  if (supportsParam(model, "temperature")) body.temperature = params.temperature
  if (supportsParam(model, "top_p")) body.top_p = params.topP

  return postChatCompletion({
    provider: "openrouter",
    url: `${OPENROUTER_BASE}/chat/completions`,
    apiKey,
    model: model.modelId,
    messages,
    body,
    extraHeaders: {
      "HTTP-Referer":
        typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "RouterDash",
    },
    signal,
  })
}

export const openRouterAdapter: ProviderAdapter = {
  id: "openrouter",
  label: PROVIDER_LABELS.openrouter,
  keyUrl: "https://openrouter.ai/keys",
  keyPlaceholder: "sk-or-v1-...",
  keyHint: "Starts with sk-or-. Catalog browsing works without a key.",
  requiresKeyForCatalog: false,
  fetchCatalog,
  runCompletion,
}
