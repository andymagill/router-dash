/**
 * Groq provider adapter.
 *
 * Groq's live `/openai/v1/models` endpoint is the source of truth for active
 * model IDs and requires the user's key. Its metadata is sparser than
 * OpenRouter's, so we normalize only what is actually present and never
 * fabricate pricing, free-tier, or modality information.
 */

import type {
  CompletionOutcome,
  ProviderAdapter,
  PromptImage,
  RunParams,
  UnifiedModel,
} from "./types"
import { makeModelKey, PROVIDER_LABELS } from "./types"
import { isChatCompatibleId, vendorSlugFromOwner } from "./compat"
import { buildUserContent, postChatCompletion } from "./openai-compat"
import { providerErrorFromResponse, providerErrorFromThrown } from "./errors"

export const GROQ_BASE = "https://api.groq.com/openai/v1"

// --- Raw Groq catalog shape -------------------------------------------------

export interface GroqModel {
  id: string
  object?: string
  created?: number
  owned_by?: string
  active?: boolean
  context_window?: number
  max_completion_tokens?: number
}

function isCompatible(model: GroqModel): boolean {
  if (model.active === false) return false
  return isChatCompatibleId(model.id)
}

export function normalizeGroqModel(model: GroqModel): UnifiedModel {
  const contextLength = model.context_window
  return {
    key: makeModelKey("groq", model.id),
    provider: "groq",
    modelId: model.id,
    // Groq provides no separate display name; the ID is the canonical label.
    name: model.id,
    vendor: vendorSlugFromOwner(model.owned_by),
    owner: model.owned_by,
    contextLength: contextLength ?? undefined,
    contextKnown: contextLength != null,
    // Groq's catalog carries no pricing; never claim free or a price.
    promptPrice: undefined,
    completionPrice: undefined,
    pricingKnown: false,
    isFree: false,
    // Modalities/supported params are not exposed by the catalog.
    inputModalities: undefined,
    supportedParameters: undefined,
  }
}

async function fetchCatalog(
  apiKey: string,
  signal?: AbortSignal,
): Promise<UnifiedModel[]> {
  if (!apiKey.trim()) {
    throw providerErrorFromResponse({
      provider: "groq",
      status: 401,
      rawMessage: "Missing Groq API key",
    })
  }
  let res: Response
  try {
    res = await fetch(`${GROQ_BASE}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw providerErrorFromThrown("groq", err)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw providerErrorFromResponse({
      provider: "groq",
      status: res.status,
      rawMessage: text,
    })
  }
  const json = await res.json()
  const data: GroqModel[] = json?.data ?? []
  return data.filter(isCompatible).map(normalizeGroqModel)
}

async function runCompletion(
  apiKey: string,
  model: UnifiedModel,
  prompt: string,
  images: PromptImage[],
  params: RunParams,
  signal?: AbortSignal,
): Promise<CompletionOutcome> {
  const messages = []
  if (params.systemPrompt.trim()) {
    messages.push({ role: "system" as const, content: params.systemPrompt })
  }
  messages.push({
    role: "user" as const,
    content: buildUserContent(prompt, images),
  })

  // Keep the payload conservative and portable. Groq accepts the standard
  // temperature/top_p and uses max_completion_tokens.
  const body: Record<string, unknown> = {
    max_completion_tokens: params.maxTokens,
    temperature: params.temperature,
    top_p: params.topP,
  }

  return postChatCompletion({
    provider: "groq",
    url: `${GROQ_BASE}/chat/completions`,
    apiKey,
    model: model.modelId,
    messages,
    body,
    signal,
  })
}

export const groqAdapter: ProviderAdapter = {
  id: "groq",
  label: PROVIDER_LABELS.groq,
  keyUrl: "https://console.groq.com/keys",
  keyPlaceholder: "gsk_...",
  keyHint: "Starts with gsk_. Required to browse and run Groq models.",
  requiresKeyForCatalog: true,
  fetchCatalog,
  runCompletion,
}
