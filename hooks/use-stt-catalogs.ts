"use client"

import * as React from "react"
import useSWR, { type SWRResponse } from "swr"

import { ADAPTERS, type ProviderId, type UnifiedModel } from "@/lib/providers"
import {
  STT_PROVIDER_ORDER,
  clearSttCache,
  loadSttModels,
  type SttProviderId,
} from "@/lib/transcription"
import type { ProviderState } from "@/components/router-dash/model-picker"

type CatalogSwr = SWRResponse<UnifiedModel[], Error>

/**
 * One SWR hook per transcription provider. OpenRouter's catalog is public, so
 * it loads without a key; Groq's needs the user's key and stays idle until one
 * is present (and reloads if it changes).
 */
function useSttProvider(provider: SttProviderId, apiKey: string): CatalogSwr {
  const trimmed = apiKey.trim()
  const swrKey = ADAPTERS[provider].requiresKeyForCatalog
    ? trimmed
      ? (["stt-catalog", provider, trimmed] as const)
      : null
    : (["stt-catalog", provider] as const)
  return useSWR(swrKey, () => loadSttModels(provider, trimmed), {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })
}

/** Loads and merges the models that can transcribe audio. */
export function useSttCatalogs(keys: Record<ProviderId, string>) {
  const groq = useSttProvider("groq", keys.groq)
  const openrouter = useSttProvider("openrouter", keys.openrouter)

  const swrByProvider = React.useMemo<Record<SttProviderId, CatalogSwr>>(
    () => ({ groq, openrouter }),
    [groq, openrouter],
  )

  const models = React.useMemo<UnifiedModel[]>(
    () => STT_PROVIDER_ORDER.flatMap((p) => swrByProvider[p].data ?? []),
    [swrByProvider],
  )

  const modelByKey = React.useMemo(() => {
    const map = new Map<string, UnifiedModel>()
    for (const m of models) map.set(m.key, m)
    return map
  }, [models])

  const providerStates = React.useMemo<Record<SttProviderId, ProviderState>>(
    () => {
      const out = {} as Record<SttProviderId, ProviderState>
      for (const p of STT_PROVIDER_ORDER) {
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

  const refreshProvider = React.useCallback(
    (provider: SttProviderId) => {
      clearSttCache(provider)
      void swrByProvider[provider].mutate()
    },
    [swrByProvider],
  )

  return { models, modelByKey, providerStates, refreshProvider }
}
