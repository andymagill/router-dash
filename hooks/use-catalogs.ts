"use client"

import * as React from "react"
import useSWR, { type SWRResponse } from "swr"

import {
  ADAPTERS,
  PROVIDER_ORDER,
  clearCatalogCache,
  loadCatalog,
  type ProviderId,
  type UnifiedModel,
} from "@/lib/providers"
import type { ProviderState } from "@/components/router-dash/model-picker"

type CatalogSwr = SWRResponse<UnifiedModel[], Error>

/**
 * One SWR hook for a single provider's catalog. Public catalogs (OpenRouter)
 * refetch independently of the key; key-gated catalogs (Groq, Cerebras) stay
 * idle until a key is present, and re-fetch when the key changes.
 */
function useProviderCatalog(provider: ProviderId, apiKey: string): CatalogSwr {
  const trimmed = apiKey.trim()
  const swrKey = ADAPTERS[provider].requiresKeyForCatalog
    ? trimmed
      ? (["catalog", provider, trimmed] as const)
      : null
    : (["catalog", provider] as const)
  return useSWR(swrKey, () => loadCatalog(provider, trimmed), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
}

/**
 * Loads and merges every provider's model catalog. React's rules-of-hooks
 * forbid looping `useSWR` over `PROVIDER_ORDER`, so each provider gets an
 * explicit hook call here; everything downstream (models, provider states,
 * refresh) is derived generically so a new provider only needs a line added
 * to this function.
 */
export function useCatalogs(keys: Record<ProviderId, string>) {
  const openrouter = useProviderCatalog("openrouter", keys.openrouter)
  const groq = useProviderCatalog("groq", keys.groq)
  const cerebras = useProviderCatalog("cerebras", keys.cerebras)

  const swrByProvider = React.useMemo<Record<ProviderId, CatalogSwr>>(
    () => ({ openrouter, groq, cerebras }),
    [openrouter, groq, cerebras],
  )

  const models = React.useMemo<UnifiedModel[]>(
    () => PROVIDER_ORDER.flatMap((p) => swrByProvider[p].data ?? []),
    [swrByProvider],
  )

  const modelByKey = React.useMemo(() => {
    const map = new Map<string, UnifiedModel>()
    for (const m of models) map.set(m.key, m)
    return map
  }, [models])

  const providerStates = React.useMemo<Record<ProviderId, ProviderState>>(
    () => {
      const out = {} as Record<ProviderId, ProviderState>
      for (const p of PROVIDER_ORDER) {
        const swr = swrByProvider[p]
        out[p] = {
          connected: keys[p].trim().length > 0,
          loading: swr.isLoading,
          error: swr.error ? swr.error.message : null,
          count: models.filter((m) => m.provider === p).length,
        }
      }
      return out
    },
    [swrByProvider, keys, models],
  )

  const anyLoading = PROVIDER_ORDER.some((p) => swrByProvider[p].isLoading)

  const refreshProvider = React.useCallback(
    (provider: ProviderId) => {
      clearCatalogCache(provider)
      void swrByProvider[provider].mutate()
    },
    [swrByProvider],
  )

  const refreshAll = React.useCallback(() => {
    for (const p of PROVIDER_ORDER) {
      if (!ADAPTERS[p].requiresKeyForCatalog || keys[p].trim()) {
        refreshProvider(p)
      }
    }
  }, [refreshProvider, keys])

  return {
    models,
    modelByKey,
    providerStates,
    anyLoading,
    refreshProvider,
    refreshAll,
  }
}
