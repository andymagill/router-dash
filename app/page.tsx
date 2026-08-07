"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { RefreshCwIcon, LayersIcon, ZapIcon } from "lucide-react"

import { Header } from "@/components/router-dash/header"
import { ModelPicker, MAX_MODELS } from "@/components/router-dash/model-picker"
import { PromptPanel } from "@/components/router-dash/prompt-panel"
import { ParamsSheet } from "@/components/router-dash/params-sheet"
import { ApiKeyDialog } from "@/components/router-dash/api-key-dialog"
import { SummaryBar } from "@/components/router-dash/summary-bar"
import { GridView } from "@/components/router-dash/grid-view"
import { DiffView } from "@/components/router-dash/diff-view"
import { Button } from "@/components/ui/button"

import { useTheme } from "@/hooks/use-theme"
import { useLocalStorage } from "@/hooks/use-local-storage"
import {
  fetchModels,
  runCompletion,
  estimateCost,
  type ORModel,
  type RunParams,
} from "@/lib/openrouter"
import type { RunState, ViewMode } from "@/lib/types"
import type { PromptPreset } from "@/lib/presets"

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
  const [view, setView] = React.useState<ViewMode>("grid")

  const [results, setResults] = React.useState<Map<string, RunState>>(new Map())
  const [running, setRunning] = React.useState(false)
  const [elapsedMs, setElapsedMs] = React.useState(0)

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

  const canDiff = selectedIds.length >= 2
  const hasResults = results.size > 0
  const resultList = selectedIds
    .map((id) => results.get(id))
    .filter(Boolean) as RunState[]

  React.useEffect(() => {
    if (!canDiff && view === "diff") setView("grid")
  }, [canDiff, view])

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

    await Promise.all(
      selectedIds.map(async (id) => {
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
          setResults((prev) => {
            const next = new Map(prev)
            next.set(id, {
              modelId: id,
              status: "done",
              content,
              usage,
              cost: model ? estimateCost(model, usage) : 0,
              latencyMs,
            })
            return next
          })
        } catch (err) {
          const latencyMs = performance.now() - t0
          const aborted =
            controller.signal.aborted ||
            (err instanceof DOMException && err.name === "AbortError")
          setResults((prev) => {
            const next = new Map(prev)
            next.set(id, {
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
            })
            return next
          })
        }
      }),
    )

    stopTimer()
    setElapsedMs(performance.now() - start)
    setRunning(false)
    abortRef.current = null
  }, [apiKey, selectedIds, prompt, params, modelById, stopTimer])

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort()
    stopTimer()
    setRunning(false)
  }, [stopTimer])

  React.useEffect(() => stopTimer, [stopTimer])

  const applyPreset = (preset: PromptPreset) => {
    setPrompt(preset.prompt)
    setParams((p) => ({ ...p, systemPrompt: preset.system }))
    toast.success(`Loaded "${preset.label}" template`)
  }

  return (
    <div className="min-h-svh bg-background">
      <Header
        theme={theme}
        onToggleTheme={toggle}
        view={view}
        onViewChange={setView}
        canDiff={canDiff}
        keySlot={
          <ApiKeyDialog
            apiKey={apiKey}
            onSave={setApiKey}
            onClear={() => setApiKey("")}
          />
        }
      />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5">
        {/* Config surface */}
        <section className="grid-dots rounded-2xl border border-border bg-card/50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <LayersIcon className="size-4 text-primary" />
              <h1 className="text-sm font-semibold">
                Compare up to {MAX_MODELS} models, side by side
              </h1>
            </div>
            <div className="flex items-center gap-1.5">
              <ParamsSheet
                params={params}
                onChange={setParams}
                selectedModels={selectedModels}
              />
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
            </div>
          </div>

          {modelsError ? (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              Failed to load the OpenRouter model catalog. Check your connection
              and retry.
            </div>
          ) : null}

          <ModelPicker
            models={models}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            loading={isLoading}
          />
        </section>

        <PromptPanel
          prompt={prompt}
          onPromptChange={setPrompt}
          onApplyPreset={applyPreset}
          onRun={handleRun}
          onCancel={handleCancel}
          running={running}
          canRun={selectedIds.length > 0 && Boolean(apiKey.trim())}
        />

        {hasResults ? (
          <>
            <SummaryBar results={resultList} elapsedMs={elapsedMs} />
            {view === "grid" || !canDiff ? (
              <GridView
                selectedIds={selectedIds}
                modelById={modelById}
                results={results}
              />
            ) : (
              <DiffView
                selectedIds={selectedIds}
                modelById={modelById}
                results={results}
              />
            )}
          </>
        ) : (
          <EmptyState
            hasSelection={selectedIds.length > 0}
            hasKey={Boolean(apiKey.trim())}
          />
        )}
      </main>
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
            ? "Select up to four models above, then hit Run to compare their responses, latency, and cost."
            : "Hit Run Benchmarks to fan your prompt out across the selected models."}
      </p>
    </div>
  )
}
