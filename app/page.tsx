"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  RefreshCwIcon,
  LayersIcon,
  ZapIcon,
  PencilIcon,
  ChevronDownIcon,
} from "lucide-react"

import { MessageSquareIcon } from "lucide-react"

import { Header } from "@/components/router-dash/header"
import { ModelPicker, MAX_MODELS } from "@/components/router-dash/model-picker"
import { PromptPanel } from "@/components/router-dash/prompt-panel"
import { ParamsSheet } from "@/components/router-dash/params-sheet"
import { ApiKeyDialog } from "@/components/router-dash/api-key-dialog"
import { SummaryBar } from "@/components/router-dash/summary-bar"
import { GridView } from "@/components/router-dash/grid-view"
import { ResultsToolbar } from "@/components/router-dash/results-toolbar"
import { HistorySheet } from "@/components/router-dash/history-sidebar"
import { ProviderBadge } from "@/components/router-dash/provider-badge"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import { useTheme } from "@/hooks/use-theme"
import { useLocalStorage } from "@/hooks/use-local-storage"
import {
  fetchModels,
  runCompletion,
  estimateCost,
  providerOf,
  type ORModel,
  type RunParams,
} from "@/lib/openrouter"
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

export default function Page() {
  const { theme, toggle } = useTheme()

  const [apiKey, setApiKey] = useLocalStorage("routerdash:key", "")
  const [selectedIds, setSelectedIds] = useLocalStorage<string[]>(
    "routerdash:models",
    [],
  )
  const [prompt, setPrompt] = useLocalStorage(
    "routerdash:prompt",
    "Explain the difference between a mutex and a semaphore to a junior developer. Keep it under 120 words and end with a one-line analogy.",
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

  // Model panel collapses while a run is active or results are shown.
  const [panelCollapsed, setPanelCollapsed] = React.useState(false)

  const abortRef = React.useRef<AbortController | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  const {
    data: models = [],
    error: modelsError,
    isLoading,
    mutate,
  } = useSWR<ORModel[]>("openrouter-models", fetchModels, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  })

  const modelById = React.useMemo(() => {
    const map = new Map<string, ORModel>()
    for (const m of models) map.set(m.id, m)
    return map
  }, [models])

  const selectedModels = React.useMemo(
    () =>
      selectedIds
        .map((id) => modelById.get(id))
        .filter(Boolean) as ORModel[],
    [selectedIds, modelById],
  )

  const hasResults = results.size > 0
  const resultList = selectedIds
    .map((id) => results.get(id))
    .filter(Boolean) as RunState[]

  // Auto-collapse the model panel on the rising edge of running/results,
  // and re-open it once everything is cleared. The user can still toggle freely.
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

  const handleRun = React.useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Add your OpenRouter API key first")
      return
    }
    if (selectedIds.length === 0) {
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
      modelIds: selectedIds.join(","),
      modelCount: selectedIds.length,
    })

    const runModelIds = [...selectedIds]

    // Seed all slots as running.
    const seeded = new Map<string, RunState>()
    for (const id of selectedIds) {
      seeded.set(id, {
        modelId: id,
        status: "running",
        content: "",
        usage: null,
        cost: 0,
        latencyMs: 0,
      })
    }
    setResults(seeded)

    const start = performance.now()
    setElapsedMs(0)
    stopTimer()
    timerRef.current = setInterval(() => {
      setElapsedMs(performance.now() - start)
    }, 100)

    const finalStates = await Promise.all(
      runModelIds.map(async (id): Promise<RunState> => {
        const model = modelById.get(id)
        const t0 = performance.now()
        try {
          const { content, usage } = await runCompletion(
            apiKey,
            id,
            prompt,
            params,
            model,
            controller.signal,
          )
          const latencyMs = performance.now() - t0
          const state: RunState = {
            modelId: id,
            status: "done",
            content,
            usage,
            cost: model ? estimateCost(model, usage) : 0,
            latencyMs,
          }
          setResults((prev) => new Map(prev).set(id, state))
          return state
        } catch (err) {
          const latencyMs = performance.now() - t0
          const aborted =
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          const state: RunState = {
            modelId: id,
            status: "error",
            content: "",
            error: aborted
              ? "Cancelled"
              : err instanceof Error
                ? err.message
                : "Request failed",
            usage: null,
            cost: 0,
            latencyMs,
          }
          setResults((prev) => new Map(prev).set(id, state))
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

    if (doneCount === 0 && failedCount > 0) {
      const firstErr = finalStates.find(
        (s) => s.status === "error" && s.error !== "Cancelled",
      )
      trackEvent("benchmark_failed", {
        modelCount: runModelIds.length,
        errorCategory: categorizeError(firstErr?.error),
      })
    } else if (doneCount > 0) {
      trackEvent("benchmark_completed", {
        modelCount: runModelIds.length,
        durationMs: Math.round(totalElapsed),
      })
    }

    // Persist to history unless the whole run was cancelled before any output.
    const produced = doneCount > 0 || failedCount > 0
    if (produced) {
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        prompt,
        params,
        modelIds: runModelIds,
        results: finalStates,
        elapsedMs: totalElapsed,
        totalCost: finalStates.reduce((sum, s) => sum + s.cost, 0),
      }
      // Never evict pinned entries; trim only the oldest unpinned ones.
      setHistory((prev) => {
        const next = [entry, ...prev]
        const pinned = next.filter((e) => e.pinned)
        const unpinned = next.filter((e) => !e.pinned)
        const keep = Math.max(0, HISTORY_LIMIT - pinned.length)
        return [...pinned, ...unpinned.slice(0, keep)]
      })
      setActiveHistoryId(entry.id)
    }
  }, [apiKey, selectedIds, prompt, params, modelById, stopTimer, setHistory])

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort()
    stopTimer()
    setRunning(false)
  }, [stopTimer])

  React.useEffect(() => stopTimer, [stopTimer])

  const applyPreset = (preset: PromptPreset) => {
    setPrompt(preset.prompt)
    setParams((p) => ({ ...p, systemPrompt: preset.system }))
    toast.success(`Loaded "${preset.label}" preset`)
  }

  const loadHistory = React.useCallback(
    (entry: HistoryEntry) => {
      if (running) handleCancel()
      setSelectedIds(entry.modelIds)
      setPrompt(entry.prompt)
      setParams(entry.params)
      setResults(new Map(entry.results.map((r) => [r.modelId, r])))
      setElapsedMs(entry.elapsedMs)
      setActiveHistoryId(entry.id)
      setPanelCollapsed(true)
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" })
      }
    },
    [running, handleCancel, setSelectedIds, setPrompt, setParams],
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
    const runs = selectedIds
      .map((id) => results.get(id))
      .filter(Boolean) as RunState[]
    const { url, truncated } = buildShareUrl(
      shareBaseUrl(),
      prompt,
      params,
      selectedIds,
      runs,
    )
    void copyShareUrl(url, truncated, "results")
  }, [selectedIds, results, prompt, params, copyShareUrl])

  const shareEntry = React.useCallback(
    (entry: HistoryEntry) => {
      const { url, truncated } = buildShareUrlFromEntry(shareBaseUrl(), entry)
      void copyShareUrl(url, truncated, "history")
    },
    [copyShareUrl],
  )

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
    toast.success(`Exported ${history.length} run${history.length === 1 ? "" : "s"} as JSON`)
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
      modelIds: selectedIds,
      page: typeof window !== "undefined" ? window.location.pathname : "/",
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    })
    trackEvent("feedback_opened")
    window.open(url, "_blank", "noopener,noreferrer")
  }, [selectedIds])

  // On first load, hydrate the workbench from a share link if one is present.
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
    setSelectedIds(payload.modelIds)
    setPrompt(payload.prompt)
    setParams(payload.params)
    const map = new Map<string, RunState>()
    for (const r of payload.results) {
      map.set(r.modelId, sharedResultToRunState(r))
    }
    setResults(map)

    if (payload.truncated) {
      toast.warning("Shared link omitted full responses to fit the URL")
    } else {
      toast.success("Loaded shared benchmark")
    }
    // Clean the URL so refresh/share doesn't re-trigger or duplicate state.
    window.history.replaceState(null, "", window.location.pathname)
  }, [setSelectedIds, setPrompt, setParams])

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
          <ApiKeyDialog
            apiKey={apiKey}
            onSave={setApiKey}
            onClear={() => setApiKey("")}
          />
        }
      />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5">
        <div className="flex flex-col gap-4">
          {/* Config surface */}
          <section className="grid-dots rounded-2xl border border-border bg-card/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <LayersIcon className="size-4 text-primary" />
                <h1 className="text-sm font-semibold">
                  {panelCollapsed
                    ? `${selectedIds.length} model${selectedIds.length === 1 ? "" : "s"} selected`
                    : `Compare up to ${MAX_MODELS} models, side by side`}
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
                      onClick={() => mutate()}
                      disabled={isLoading}
                      aria-label="Refresh model catalog"
                    >
                      <RefreshCwIcon
                        className={isLoading ? "size-4 animate-spin" : "size-4"}
                      />
                    </Button>
                  </>
                )}
              </div>
            </div>

            {panelCollapsed ? (
              <CollapsedModels
                selectedIds={selectedIds}
                modelById={modelById}
                onExpand={() => setPanelCollapsed(false)}
              />
            ) : (
              <>
                {modelsError ? (
                  <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    Failed to load the OpenRouter model catalog. Check your
                    connection and retry.
                  </div>
                ) : null}

                <ModelPicker
                  models={models}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                  loading={isLoading}
                />
              </>
            )}
          </section>

          <PromptPanel
            prompt={prompt}
            onPromptChange={setPrompt}
            onApplyPreset={applyPreset}
            onRun={handleRun}
            onCancel={handleCancel}
            running={running}
            canRun={selectedIds.length > 0 && Boolean(apiKey.trim())}
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
                onExportJson={exportJson}
                onExportCsv={exportCsv}
              />
              <GridView
                selectedIds={selectedIds}
                modelById={modelById}
                results={results}
              />
            </>
          ) : (
            <EmptyState
              hasSelection={selectedIds.length > 0}
              hasKey={Boolean(apiKey.trim())}
            />
          )}
        </div>
      </main>

      <footer className="mt-4 border-t border-border/50 py-4 text-center">
        <a
          href="https://magill.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Built by Andrew Magill
        </a>
      </footer>
    </div>
  )
}

function CollapsedModels({
  selectedIds,
  modelById,
  onExpand,
}: {
  selectedIds: string[]
  modelById: Map<string, ORModel>
  onExpand: () => void
}) {
  if (selectedIds.length === 0) {
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
      {selectedIds.map((id, idx) => {
        const m = modelById.get(id)
        const slug = m ? providerOf(m) : id.split("/")[0]
        return (
          <Badge
            key={id}
            variant="outline"
            className="h-7 gap-1.5 border-border bg-surface pr-2 pl-1.5"
          >
            <span className="grid size-4 place-items-center rounded bg-primary/15 font-mono text-[9px] font-semibold text-primary">
              {String.fromCharCode(65 + idx)}
            </span>
            <ProviderBadge slug={slug} className="size-4" />
            <span className="max-w-40 truncate font-medium">
              {m?.name ?? id}
            </span>
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
          ? "Add your OpenRouter API key, pick a few models, and run one prompt across all of them."
          : !hasSelection
            ? `Select up to ${MAX_MODELS} models above, then hit Run to compare their responses, latency, and cost.`
            : "Hit Run Benchmarks to fan your prompt out across the selected models."}
      </p>
    </div>
  )
}
