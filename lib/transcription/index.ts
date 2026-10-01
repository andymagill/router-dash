/**
 * Speech-to-text registry + barrel. Import transcription types and helpers
 * from "@/lib/transcription".
 */

import type { UnifiedModel } from "@/lib/providers/types"
import {
  clearCatalogCache,
  readCatalogCache,
  writeCatalogCache,
} from "@/lib/providers/catalog-cache"
import { STT_ADAPTERS } from "./adapters"
import type { SttProviderId } from "./types"

export * from "./types"
export { STT_ADAPTERS } from "./adapters"
export { runTranscription } from "./run"

/** Groq's STT models get their own cache entry, apart from its chat catalog. */
const STT_CACHE_SCOPE = "stt"

/**
 * List a provider's transcription models. Groq's list is cached locally;
 * OpenRouter's is derived from the chat catalog, which has its own cache.
 * To force a refetch, call `clearSttCache` first.
 */
export async function loadSttModels(
  provider: SttProviderId,
  apiKey: string,
  opts: { signal?: AbortSignal } = {},
): Promise<UnifiedModel[]> {
  if (provider === "openrouter") {
    return STT_ADAPTERS.openrouter.listModels(apiKey, opts.signal)
  }
  const cached = readCatalogCache(provider, { scope: STT_CACHE_SCOPE })
  if (cached) return cached
  const models = await STT_ADAPTERS[provider].listModels(apiKey, opts.signal)
  writeCatalogCache(provider, models, { scope: STT_CACHE_SCOPE })
  return models
}

export function clearSttCache(provider: SttProviderId): void {
  if (provider === "openrouter") {
    // Its transcription list is a filtered view of the chat catalog's cache.
    clearCatalogCache("openrouter")
    return
  }
  clearCatalogCache(provider, { scope: STT_CACHE_SCOPE })
}
