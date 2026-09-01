"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  RefreshCwIcon,
  LayersIcon,
  ZapIcon,
  PencilIcon,
  ChevronDownIcon,
  MessageSquareIcon,
} from "lucide-react"

import { Header } from "@/components/router-dash/header"
import { ModelPicker, MAX_MODELS } from "@/components/router-dash/model-picker"
import { PromptPanel } from "@/components/router-dash/prompt-panel"
import { ParamsSheet } from "@/components/router-dash/params-sheet"
import { ApiKeyDialog } from "@/components/router-dash/api-key-dialog"
import { SummaryBar } from "@/components/router-dash/summary-bar"
import { GridView } from "@/components/router-dash/grid-view"
import { ResultsToolbar } from "@/components/router-dash/results-toolbar"
import { HistorySheet } from "@/components/router-dash/history-sidebar"
import {
  ProviderBadge,
  ProviderTag,
} from "@/components/router-dash/provider-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { useTheme } from "@/hooks/use-theme"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useCatalogs } from "@/hooks/use-catalogs"
import {
  type UnifiedModel,
  type RunParams,
  type ProviderId,
  type PromptImage,
  PROVIDER_ORDER,
  ADAPTERS,
  getAdapter,
  clearCatalogCache,
  estimateCost,
  parseModelKey,
  normalizeStoredKey,
  vendorSlugFromId,
  supportsVision,
} from "@/lib/providers"
import { HISTORY_LIMIT, type HistoryEntry, type RunState } from "@/lib/types"
import type { PromptPreset } from "@/lib/presets"
import {
  SHARE_PARAM,
  decodeShareToken,
  buildShareUrl,
  buildShareUrlFromEntry,
  sharedResultToRunState,
} from "@/lib/share"
import {
  serializeJsonExport,
  buildCsvExport,
  parseJsonImport,
  downloadTextFile,
} from "@/lib/export"
import { trackEvent, categorizeError } from "@/lib/analytics"
import { buildFeedbackUrl } from "@/lib/feedback"

const DEFAULT_PARAMS: RunParams = {
  systemPrompt: "",
  temperature: 1,
  topP: 1,
  maxTokens: 1024,
}

const EMPTY_KEYS: Record<ProviderId, string> = {
  openrouter: "",
  groq: "",
  cerebras: "",
}

/** Resolve a selected key to a model, synthesizing a stub if it's not in the
 * loaded catalog (e.g. loaded from history while its provider key is absent). */
function resolveModel(
  key: string,
  modelByKey: Map<string, UnifiedModel>,
): UnifiedModel {
  const found = modelByKey.get(key)
  if (found) return found
  const { provider, modelId } = parseModelKey(key)
  return {
    key,
    provider,
    modelId,
    name: modelId,
    // OpenRouter ids are "vendor/model"; other providers' ids are bare.
    vendor: modelId.includes("/") ? vendorSlugFromId(modelId) : "unknown",
    contextKnown: false,
    pricingKnown: false,
    isFree: false,
  }
}

export default function Page() {
  const { theme, toggle } = useTheme()

  const [storedKeys, setKeys] = useLocalStorage<Record<ProviderId, string>>(
    "routerdash:keys",
    EMPTY_KEYS,
  )
  // Backfill any provider added after a browser's keys were first saved
  // (e.g. Cerebras, for a value saved before it existed) so every consumer
  // can safely call `.trim()` on `keys[provider]` without an undefined check.
  const keys = React.useMemo<Record<ProviderId, string>>(
    () => ({ ...EMPTY_KEYS, ...storedKeys }),
    [storedKeys],
  )
  const [selectedKeys, setSelectedKeys] = useLocalStorage<string[]>(
    "routerdash:models",
    [],
  )
  const [prompt, setPrompt] = useLocalStorage(
    "routerdash:prompt",
    "Explain the difference between a mutex and a semaphore to a junior developer. Keep it under 120 words and end with a one-line analogy.",
  )
  const [images, setImages] = useLocalStorage<PromptImage[]>(
    "routerdash:images",
    [],
  )
  const [params, setParams] = useLocalStorage<RunParams>(
    "routerdash:params",
    DEFAULT_PARAMS,
  )
  const [storageWarning, setStorageWarning] = React.useState(false)
  const [history, setHistory] = useLocalStorage<HistoryEntry[]>(
    "routerdash:history",
    [],
    {
      onError: () => {
        setStorageWarning(true)
        toast.error("Browser storage is full — export or clear some history.")
      },
    },
  )
  const [activeHistoryId, setActiveHistoryId] = React.useState<string | null>(
    null,
  )

  const [results, setResults] = React.useState<Map<string, RunState>>(new Map())
  const [running, setRunning] = React.useState(false)
  const [elapsedMs, setElapsedMs] = React.useState(0)

  const [panelCollapsed, setPanelCollapsed] = React.useState(false)

  const abortRef = React.useRef<AbortController | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // One-time migration from the legacy single-provider storage shape.
  const migrated = React.useRef(false)
  React.useEffect(() => {
    if (migrated.current || typeof window === "undefined") return
    migrated.current = true
    // Legacy OpenRouter-only key.
    try {
      const legacy = window.localStorage.getItem("routerdash:key")
      if (legacy) {
        const parsed = JSON.parse(legacy)
        if (typeof parsed === "string" && parsed.trim()) {
          setKeys((prev) =>
            prev.openrouter.trim()
              ? prev
              : { ...prev, openrouter: parsed },
          )
        }
        window.localStorage.removeItem("routerdash:key")
      }
    } catch {
      // ignore malformed legacy value
    }
    // Legacy bare model IDs → composite keys.
    setSelectedKeys((prev) => {
      const next = prev.map(normalizeStoredKey)
      return next.some((k, i) => k !== prev[i]) ? next : prev
    })
    // Legacy history entries → composite keys on modelIds + result.modelId.
    setHistory((prev) => {
      let changed = false
      const next = prev.map((e) => {
        const modelIds = e.modelIds.map(normalizeStoredKey)
        const resultsN = e.results.map((r) => {
          const nk = normalizeStoredKey(r.modelId)
          if (nk !== r.modelId) changed = true
          return { ...r, modelId: nk }
        })
        if (modelIds.some((k, i) => k !== e.modelIds[i])) changed = true
        return { ...e, modelIds, results: resultsN }
      })
      return changed ? next : prev
    })
  }, [setKeys, setSelectedKeys, setHistory])

  const {
    models,
    modelByKey,
    providerStates,
    anyLoading,
    refreshProvider,
    refreshAll,
  } = useCatalogs(keys)

  const selectedModels = React.useMemo(
    () => selectedKeys.map((k) => resolveModel(k, modelByKey)),
    [selectedKeys, modelByKey],
  )

  const hasResults = results.size > 0
  const resultList = Array.from(results.values())

  const active = running || hasResults
  const prevActive = React.useRef(false)
  React.useEffect(() => {
    if (active && !prevActive.current) setPanelCollapsed(true)
    if (!active) setPanelCollapsed(false)
    prevActive.current = active
  }, [active])

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const saveKey = React.useCallback(
    (provider: ProviderId, key: string) =>
      setKeys((prev) => ({ ...prev, [provider]: key })),
    [setKeys],
  )
  const clearKey = React.useCallback(
    (provider: ProviderId) => {
      setKeys((prev) => ({ ...prev, [provider]: "" }))
      clearCatalogCache(provider)
    },
    [setKeys],
  )

  const connectedCount = PROVIDER_ORDER.filter((p) =>
    keys[p].trim(),
  ).length
  // A run is possible when at least one selected model belongs to a provider
  // that has a key.
  const runnableSelected = selectedKeys.some((k) =>
    keys[parseModelKey(k).provider].trim(),
  )
  const canRun = selectedKeys.length > 0 && runnableSelected

  const handleRun = React.useCallback(async () => {
    if (connectedCount === 0) {
      toast.error("Add a provider API key first")
      return
    }
    if (selectedKeys.length === 0) {
      toast.error("Select at least one model to compare")
      return
    }
    if (!prompt.trim()) {
      toast.error("Enter a prompt to run")
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    setActiveHistoryId(null)

    trackEvent("benchmark_started", {
      modelIds: selectedKeys.join(","),
      modelCount: selectedKeys.length,
    })

    const runKeys = [...selectedKeys]
    const runImages = [...images]

    setResults((prev) => {
      const next = new Map(prev)
      for (const key of runKeys) {
        next.set(key, {
          modelId: key,
          status: "running",
          content: "",
          usage: null,
          cost: 0,
          latencyMs: 0,
        })
      }
      return next
    })

    const start = performance.now()
    setElapsedMs(0)
    stopTimer()
    timerRef.current = setInterval(() => {
      setElapsedMs(performance.now() - start)
    }, 100)

    const finalStates = await Promise.all(
      runKeys.map(async (key): Promise<RunState> => {
        const model = resolveModel(key, modelByKey)
        const providerKey = keys[model.provider]
        const t0 = performance.now()

        // Guard: a selected model whose provider has no key can't run.
        if (!providerKey.trim()) {
          const state: RunState = {
            modelId: key,
            status: "error",
            content: "",
            error: `Add your ${ADAPTERS[model.provider].label} key to run this model`,
            usage: null,
            cost: 0,
            latencyMs: 0,
          }
          setResults((prev) => new Map(prev).set(key, state))
          return state
        }

        // Guard: a positively-known text-only model can't take images —
        // skip it instead of sending a guaranteed-invalid request.
        if (runImages.length > 0 && !supportsVision(model)) {
          const state: RunState = {
            modelId: key,
            status: "skipped",
            content: "",
            error: "This model does not support image input",
            usage: null,
            cost: 0,
            latencyMs: 0,
          }
          setResults((prev) => new Map(prev).set(key, state))
          return state
        }

        try {
          const { content, usage } = await getAdapter(
            model.provider,
          ).runCompletion(
            providerKey,
            model,
            prompt,
            runImages,
            params,
            controller.signal,
          )
          const latencyMs = performance.now() - t0
          const state: RunState = {
            modelId: key,
            status: "done",
            content,
            usage,
            cost: estimateCost(model, usage),
            latencyMs,
          }
          setResults((prev) => new Map(prev).set(key, state))
          return state
        } catch (err) {
          const latencyMs = performance.now() - t0
          const aborted =
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          const state: RunState = {
            modelId: key,
            status: "error",
            content: "",
            // ProviderError.message is a pre-sanitized, credential-free summary.
            error: aborted
              ? "Cancelled"
              : err instanceof Error
                ? err.message
                : "Request failed",
            usage: null,
            cost: 0,
            latencyMs,
          }
          setResults((prev) => new Map(prev).set(key, state))
          return state
        }
      }),
    )

    stopTimer()
    const totalElapsed = performance.now() - start
    setElapsedMs(totalElapsed)
    setRunning(false)
    abortRef.current = null

    const doneCount = finalStates.filter((s) => s.status === "done").length
    const failedCount = finalStates.filter(
      (s) => s.status === "error" && s.error !== "Cancelled",
    ).length
    const skippedCount = finalStates.filter(
      (s) => s.status === "skipped",
    ).length

    if (doneCount === 0 && failedCount > 0) {
      const firstErr = finalStates.find(
        (s) => s.status === "error" && s.error !== "Cancelled",
      )
      trackEvent("benchmark_failed", {
        modelCount: runKeys.length,
        errorCategory: categorizeError(firstErr?.error),
      })
    } else if (doneCount > 0) {
      trackEvent("benchmark_completed", {
        modelCount: runKeys.length,
        durationMs: Math.round(totalElapsed),
      })
    }

    const produced = doneCount > 0 || failedCount > 0 || skippedCount > 0
    if (produced) {
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        prompt,
        images: runImages,
        params,
        modelIds: runKeys,
        results: finalStates,
        elapsedMs: totalElapsed,
        totalCost: finalStates.reduce((sum, s) => sum + s.cost, 0),
      }
      setHistory((prev) => {
        const next = [entry, ...prev]
        const pinned = next.filter((e) => e.pinned)
        const unpinned = next.filter((e) => !e.pinned)
        const keep = Math.max(0, HISTORY_LIMIT - pinned.length)
        return [...pinned, ...unpinned.slice(0, keep)]
      })
      setActiveHistoryId(entry.id)
    }
  }, [
    connectedCount,
    selectedKeys,
    prompt,
    images,
    params,
    modelByKey,
    keys,
    stopTimer,
    setHistory,
  ])

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort()
    stopTimer()
    setRunning(false)
  }, [stopTimer])

  React.useEffect(() => stopTimer, [stopTimer])

  const applyPreset = (preset: PromptPreset) => {
    setPrompt(preset.prompt)
    setImages([])
    setParams((p) => ({ ...p, systemPrompt: preset.system }))
    toast.success(`Loaded "${preset.label}" preset`)
  }

  const loadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      if (running) handleCancel()
      const modelIds = entry.modelIds.map(normalizeStoredKey)
      setSelectedKeys(modelIds)
      setPrompt(entry.prompt)
      setImages(entry.images ?? [])
      setParams(entry.params)
      setResults(
        new Map(
          entry.results.map((r) => {
            const nk = normalizeStoredKey(r.modelId)
            return [nk, { ...r, modelId: nk }]
          }),
        ),
      )
      setElapsedMs(entry.elapsedMs)
      setActiveHistoryId(entry.id)
      setPanelCollapsed(true)
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    },
    [running, handleCancel, setSelectedKeys, setPrompt, setImages, setParams],
  )

  const deleteHistory = React.useCallback(
    (id: string) => {
      setHistory((prev) => prev.filter((e) => e.id !== id))
      setActiveHistoryId((cur) => (cur === id ? null : cur))
    },
    [setHistory],
  )

  const clearHistory = React.useCallback(() => {
    setHistory([])
    setActiveHistoryId(null)
    toast.success("History cleared")
  }, [setHistory])

  const togglePin = React.useCallback(
    (id: string) => {
      setHistory((prev) =>
        prev.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)),
      )
    },
    [setHistory],
  )

  const copyShareUrl = React.useCallback(
    async (url: string, truncated: boolean, source: string) => {
      try {
        await navigator.clipboard.writeText(url)
        toast.success(
          truncated
            ? "Share link copied — responses were trimmed to fit the URL"
            : "Share link copied to clipboard",
        )
        trackEvent("share_link_copied", { source, truncated })
      } catch {
        toast.error("Couldn't copy the link to your clipboard")
      }
    },
    [],
  )

  const shareBaseUrl = () =>
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}${window.location.pathname}`

  const shareCurrent = React.useCallback(() => {
    const runs = selectedKeys
      .map((k) => results.get(k))
      .filter(Boolean) as RunState[]
    const { url, truncated } = buildShareUrl(
      shareBaseUrl(),
      prompt,
      params,
      selectedKeys,
      runs,
    )
    void copyShareUrl(url, truncated, "results")
  }, [selectedKeys, results, prompt, params, copyShareUrl])

  const shareEntry = React.useCallback(
    (entry: HistoryEntry) => {
      const { url, truncated } = buildShareUrlFromEntry(shareBaseUrl(), entry)
      void copyShareUrl(url, truncated, "history")
    },
    [copyShareUrl],
  )

  const exportCurrentJson = React.useCallback(() => {
    if (selectedKeys.length === 0) {
      toast.error("No results to export yet")
      return
    }
    const runs = selectedKeys
      .map((k) => results.get(k))
      .filter(Boolean) as RunState[]
    if (runs.length === 0) {
      toast.error("No results to export yet")
      return
    }
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      prompt,
      images,
      params,
      modelIds: selectedKeys,
      results: runs,
      elapsedMs,
      totalCost: runs.reduce((sum, r) => sum + r.cost, 0),
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `routerdash-run-${stamp}.json`,
      serializeJsonExport([entry]),
      "application/json",
    )
    trackEvent("result_exported", { exportFormat: "json", scope: "current" })
    toast.success("Exported current run as JSON")
  }, [selectedKeys, results, prompt, images, params, elapsedMs])

  const exportCurrentCsv = React.useCallback(() => {
    if (selectedKeys.length === 0) {
      toast.error("No results to export yet")
      return
    }
    const runs = selectedKeys
      .map((k) => results.get(k))
      .filter(Boolean) as RunState[]
    if (runs.length === 0) {
      toast.error("No results to export yet")
      return
    }
    const entry: HistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      prompt,
      images,
      params,
      modelIds: selectedKeys,
      results: runs,
      elapsedMs,
      totalCost: runs.reduce((sum, r) => sum + r.cost, 0),
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `routerdash-run-${stamp}.csv`,
      buildCsvExport([entry]),
      "text/csv;charset=utf-8",
    )
    trackEvent("result_exported", { exportFormat: "csv", scope: "current" })
    toast.success("Exported current run as CSV")
  }, [selectedKeys, results, prompt, images, params, elapsedMs])

  const exportJson = React.useCallback(() => {
    if (history.length === 0) {
      toast.error("No history to export yet")
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `routerdash-history-${stamp}.json`,
      serializeJsonExport(history),
      "application/json",
    )
    trackEvent("result_exported", { exportFormat: "json" })
    toast.success(
      `Exported ${history.length} run${history.length === 1 ? "" : "s"} as JSON`,
    )
  }, [history])

  const exportCsv = React.useCallback(() => {
    if (history.length === 0) {
      toast.error("No history to export yet")
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    downloadTextFile(
      `routerdash-history-${stamp}.csv`,
      buildCsvExport(history),
      "text/csv;charset=utf-8",
    )
    trackEvent("result_exported", { exportFormat: "csv" })
    toast.success("Exported history summary as CSV")
  }, [history])

  const importFile = React.useCallback(
    async (file: File) => {
      try {
        const text = await file.text()
        const result = parseJsonImport(text, history)
        if (!result.ok) {
          toast.error(result.reason)
          return
        }
        if (result.imported === 0) {
          toast.info(
            result.duplicates > 0
              ? "Those runs are already in your history"
              : "No runs found to import",
          )
          return
        }
        setHistory((prev) => {
          const merged = [...result.entries, ...prev]
          const pinned = merged.filter((e) => e.pinned)
          const unpinned = merged.filter((e) => !e.pinned)
          const keep = Math.max(0, HISTORY_LIMIT - pinned.length)
          return [...pinned, ...unpinned.slice(0, keep)]
        })
        toast.success(
          `Imported ${result.imported} run${result.imported === 1 ? "" : "s"}` +
            (result.duplicates
              ? `, skipped ${result.duplicates} duplicate${result.duplicates === 1 ? "" : "s"}`
              : ""),
        )
      } catch {
        toast.error("Couldn't read that file")
      }
    },
    [history, setHistory],
  )

  const openFeedback = React.useCallback(() => {
    const url = buildFeedbackUrl({
      modelIds: selectedKeys,
      page: typeof window !== "undefined" ? window.location.pathname : "/",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    })
    trackEvent("feedback_opened")
    window.open(url, "_blank", "noopener,noreferrer")
  }, [selectedKeys])

  // Hydrate from a share link on first load.
  const sharedApplied = React.useRef(false)
  React.useEffect(() => {
    if (sharedApplied.current || typeof window === "undefined") return
    const search = new URLSearchParams(window.location.search)
    const token = search.get(SHARE_PARAM)
    if (!token) return
    sharedApplied.current = true

    const decoded = decodeShareToken(token)
    if (!decoded.ok) {
      toast.error(`Couldn't open shared link: ${decoded.reason}`)
      window.history.replaceState(null, "", window.location.pathname)
      return
    }

    const payload = decoded.payload
    setSelectedKeys(payload.modelIds.map(normalizeStoredKey))
    setPrompt(payload.prompt)
    // Share links never carry image data (see lib/share.ts) — clear any
    // locally-attached images so they aren't misread as part of this shared
    // prompt.
    setImages([])
    setParams(payload.params)
    const map = new Map<string, RunState>()
    for (const r of payload.results) {
      const nk = normalizeStoredKey(r.modelId)
      map.set(nk, { ...sharedResultToRunState(r), modelId: nk })
    }
    setResults(map)

    if (payload.truncated) {
      toast.warning("Shared link omitted full responses to fit the URL")
    } else {
      toast.success("Loaded shared benchmark")
    }
    window.history.replaceState(null, "", window.location.pathname)
  }, [setSelectedKeys, setPrompt, setImages, setParams])

  return (
    <div className="min-h-svh bg-background">
      <Header
        theme={theme}
        onToggleTheme={toggle}
        historySlot={
          <HistorySheet
            entries={history}
            activeId={activeHistoryId}
            storageWarning={storageWarning}
            onSelect={loadHistory}
            onDelete={deleteHistory}
            onClear={clearHistory}
            onTogglePin={togglePin}
            onShare={shareEntry}
            onExportJson={exportJson}
            onExportCsv={exportCsv}
            onImportFile={importFile}
          />
        }
        feedbackSlot={
          <Button
            variant="ghost"
            size="icon"
            onClick={openFeedback}
            aria-label="Send feedback on GitHub"
            className="size-8"
          >
            <MessageSquareIcon className="size-4" />
          </Button>
        }
        keySlot={
          <ApiKeyDialog keys={keys} onSave={saveKey} onClear={clearKey} />
        }
      />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5">
        <div className="flex flex-col gap-4">
          <section className="grid-dots rounded-2xl border border-border bg-card/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayersIcon className="size-4 text-primary" />
                <h1 className="text-sm font-semibold">
                  {selectedKeys.length} model
                  {selectedKeys.length === 1 ? "" : "s"} selected
                </h1>
              </div>
              <div className="flex items-center gap-1.5">
                {panelCollapsed ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setPanelCollapsed(false)}
                  >
                    <PencilIcon data-icon="inline-start" />
                    Edit models
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => setPanelCollapsed(true)}
                    >
                      <ChevronDownIcon data-icon="inline-start" />
                      Collapse
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={refreshAll}
                      disabled={anyLoading}
                      aria-label="Refresh model catalogs"
                    >
                      <RefreshCwIcon
                        className={anyLoading ? "size-4 animate-spin" : "size-4"}
                      />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {panelCollapsed ? (
              <CollapsedModels
                selectedKeys={selectedKeys}
                modelByKey={modelByKey}
                hasImages={images.length > 0}
                onExpand={() => setPanelCollapsed(false)}
              />
            ) : (
              <ModelPicker
                models={models}
                providerStates={providerStates}
                selectedKeys={selectedKeys}
                onChange={setSelectedKeys}
                onRefresh={refreshProvider}
              />
            )}
          </section>

          <PromptPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            images={images}
            onImagesChange={setImages}
            onApplyPreset={applyPreset}
            onRun={handleRun}
            onCancel={handleCancel}
            running={running}
            canRun={canRun}
            paramsSlot={
              <ParamsSheet
                params={params}
                onChange={setParams}
                selectedModels={selectedModels}
              />
            }
          />

          {hasResults ? (
            <>
              <SummaryBar results={resultList} elapsedMs={elapsedMs} />
              <ResultsToolbar
                onShare={shareCurrent}
                onExportJson={exportCurrentJson}
                onExportCsv={exportCurrentCsv}
              />
              <GridView
                selectedKeys={selectedKeys}
                modelByKey={modelByKey}
                results={results}
              />
            </>
          ) : (
            <EmptyState
              hasSelection={selectedKeys.length > 0}
              hasKey={connectedCount > 0}
            />
          )}
        </div>
      </main>

      <footer className="mt-4 border-t border-border/50 py-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-1 text-xs text-muted-foreground">
          <a
            href="https://magill.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Built by Andrew Magill
          </a>
          <span>·</span>
          <Link
            href="/terms"
            className="transition-colors hover:text-foreground"
          >
            Terms
          </Link>
          <span>·</span>
          <a
            href="https://github.com/andymagill/router-dash/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Report an Issue
          </a>
        </div>
      </footer>
    </div>
  )
}

function CollapsedModels({
  selectedKeys,
  modelByKey,
  hasImages,
  onExpand,
}: {
  selectedKeys: string[]
  modelByKey: Map<string, UnifiedModel>
  hasImages: boolean
  onExpand: () => void
}) {
  if (selectedKeys.length === 0) {
    return (
      <button
        type="button"
        onClick={onExpand}
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
      >
        No models selected — click to choose
      </button>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selectedKeys.map((key, idx) => {
        const m = modelByKey.get(key)
        const parsed = parseModelKey(key)
        const slug = m?.vendor ?? parsed.modelId.split("/")[0]
        const noVision = hasImages && m && !supportsVision(m)
        return (
          <Badge
            key={key}
            variant="outline"
            className="h-7 gap-1.5 border-border bg-surface pr-2 pl-1.5"
          >
            <span className="grid size-4 place-items-center rounded bg-primary/15 font-mono text-[9px] font-semibold text-primary">
              {String.fromCharCode(65 + idx)}
            </span>
            <ProviderBadge slug={slug} className="size-4" />
            <span className="max-w-40 truncate font-medium">
              {m?.name ?? parsed.modelId}
            </span>
            <ProviderTag provider={m?.provider ?? parsed.provider} />
            {noVision && (
              <span
                className="flex items-center gap-1 rounded-full bg-[color:var(--warn)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--warn)]"
                title="This model does not support image input"
              >
                No image support
              </span>
            )}
          </Badge>
        )
      })}
    </div>
  )
}

function EmptyState({
  hasSelection,
  hasKey,
}: {
  hasSelection: boolean
  hasKey: boolean
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-20 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <ZapIcon className="size-6" />
      </div>
      <h2 className="text-base font-semibold">Ready to benchmark</h2>
      <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
        {!hasKey
          ? "Add a provider API key, pick a few models, and run one prompt across all of them."
          : !hasSelection
            ? `Select up to ${MAX_MODELS} models above, then hit Run to compare their responses, latency, and cost.`
            : "Hit Run Benchmarks to fan your prompt out across the selected models."}
      </p>
    </div>
  )
}
