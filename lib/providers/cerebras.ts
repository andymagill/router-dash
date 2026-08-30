/**
 * Cerebras provider adapter.
 *
 * Cerebras' `/v1/models` endpoint is OpenAI-compatible and requires the
 * user's key, mirroring Groq. Its metadata is sparse (no pricing, no
 * guaranteed context length), so we normalize only what is actually present
 * and never fabricate pricing, free-tier, or modality information.
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

export const CEREBRAS_BASE = "https://api.cerebras.ai/v1"

// --- Raw Cerebras catalog shape ---------------------------------------------

export interface CerebrasModel {
  id: string
  object?: string
  created?: number
  owned_by?: string
  context_window?: number
}

function isCompatible(model: CerebrasModel): boolean {
  return isChatCompatibleId(model.id)
}

export function normalizeCerebrasModel(model: CerebrasModel): UnifiedModel {
  const contextLength = model.context_window
  return {
    key: makeModelKey("cerebras", model.id),
    provider: "cerebras",
    modelId: model.id,
    // Cerebras provides no separate display name; the ID is the canonical label.
    name: model.id,
    vendor: vendorSlugFromOwner(model.owned_by),
    owner: model.owned_by,
    contextLength: contextLength ?? undefined,
    contextKnown: contextLength != null,
    // Cerebras' catalog carries no pricing; never claim free or a price.
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
      provider: "cerebras",
      status: 401,
      rawMessage: "Missing Cerebras API key",
    })
  }
  let res: Response
  try {
    res = await fetch(`${CEREBRAS_BASE}/models`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw providerErrorFromThrown("cerebras", err)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw providerErrorFromResponse({
      provider: "cerebras",
      status: res.status,
      rawMessage: text,
    })
  }
  const json = await res.json()
  const data: CerebrasModel[] = json?.data ?? []
  return data.filter(isCompatible).map(normalizeCerebrasModel)
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

  // Keep the payload conservative and portable. Cerebras accepts the standard
  // temperature/top_p and uses max_completion_tokens (like Groq).
  const body: Record<string, unknown> = {
    max_completion_tokens: params.maxTokens,
    temperature: params.temperature,
    top_p: params.topP,
  }

  return postChatCompletion({
    provider: "cerebras",
    url: `${CEREBRAS_BASE}/chat/completions`,
    apiKey,
    model: model.modelId,
    messages,
    body,
    signal,
  })
}

export const cerebrasAdapter: ProviderAdapter = {
  id: "cerebras",
  label: PROVIDER_LABELS.cerebras,
  keyUrl: "https://cloud.cerebras.ai/",
  keyPlaceholder: "csk-...",
  keyHint: "Starts with csk-. Required to browse and run Cerebras models.",
  requiresKeyForCatalog: true,
  fetchCatalog,
  runCompletion,
}
