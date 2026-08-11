/**
 * Provider registry + barrel. Import provider-aware types and helpers from
 * "@/lib/providers".
 */

import type { ProviderId, ProviderAdapter, UnifiedModel } from "./types"
import { openRouterAdapter } from "./openrouter"
import { groqAdapter } from "./groq"
import {
  CATALOG_TTL_MS,
  readCatalogCache,
  writeCatalogCache,
  clearCatalogCache,
} from "./catalog-cache"

export * from "./types"
export * from "./errors"
export { openRouterAdapter } from "./openrouter"
export { groqAdapter } from "./groq"
export {
  CATALOG_TTL_MS,
  readCatalogCache,
  writeCatalogCache,
  clearCatalogCache,
  isEntryFresh,
} from "./catalog-cache"
export type { CacheStorage } from "./catalog-cache"
export { isChatCompatibleId, vendorSlugFromId, vendorSlugFromOwner } from "./compat"

export const ADAPTERS: Record<ProviderId, ProviderAdapter> = {
  openrouter: openRouterAdapter,
  groq: groqAdapter,
}

export function getAdapter(provider: ProviderId): ProviderAdapter {
  return ADAPTERS[provider]
}

/** Providers in stable display order. */
export const PROVIDER_ORDER: ProviderId[] = ["openrouter", "groq"]

/**
 * Load a provider's catalog, using the fresh local cache when available.
 * Pass `force: true` (manual refresh) to bypass and rewrite the cache.
 */
export async function loadCatalog(
  provider: ProviderId,
  apiKey: string,
  opts: { force?: boolean; signal?: AbortSignal } = {},
): Promise<UnifiedModel[]> {
  if (!opts.force) {
    const cached = readCatalogCache(provider)
    if (cached) return cached
  }
  const models = await getAdapter(provider).fetchCatalog(apiKey, opts.signal)
  writeCatalogCache(provider, models)
  return models
}
