"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  AudioLinesIcon,
  LayersIcon,
  Loader2Icon,
  PlayIcon,
  SquareIcon,
} from "lucide-react"

import { Header } from "@/components/router-dash/header"
import { SiteFooter } from "@/components/router-dash/site-footer"
import { ApiKeyDialog } from "@/components/router-dash/api-key-dialog"
import { AudioDropzone } from "@/components/transcribe/audio-dropzone"
import { SessionPlayer } from "@/components/transcribe/session-player"
import { SessionsSheet } from "@/components/transcribe/sessions-sheet"
import { SttModelPicker } from "@/components/transcribe/stt-model-picker"
import { TranscriptGrid } from "@/components/transcribe/transcript-grid"
import { Button } from "@/components/ui/button"

import { useTheme } from "@/hooks/use-theme"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useSttCatalogs } from "@/hooks/use-stt-catalogs"
import {
  clearCatalogCache,
  type ProviderId,
} from "@/lib/providers"
import {
  MAX_AUDIO_SECONDS,
  readAudioDurationMs,
  validateAudioFile,
} from "@/lib/audio/validate"
import {
  createIndexedDbAudioStore,
  isStorageNearlyFull,
  removeOrphanedAudio,
  requestPersistence,
} from "@/lib/audio-store"
import {
  TRANSCRIPTION_LANGUAGES,
  clearSttCache,
  isSttProvider,
  runTranscription,
  type AudioInput,
  type TranscriptResult,
  type TranscriptionSession,
} from "@/lib/transcription"
import { resolveSttModel } from "@/lib/transcription/models"
import {
  createSession,
  enforceLimit,
  mergeResults,
  parseSessions,
} from "@/lib/transcription/sessions"
import { formatLatency } from "@/lib/format"
import { trackEvent, categorizeError } from "@/lib/analytics"

const EMPTY_KEYS: Record<ProviderId, string> = {
  openrouter: "",
  groq: "",
  cerebras: "",
}

/** The audio currently on screen, and whether it is saved yet. */
interface Loaded {
  session: TranscriptionSession
  /** Null when a saved session's audio is gone from this browser. */
  blob: Blob | null
  persisted: boolean
}

const isCancelled = (r: TranscriptResult) =>
  r.status === "error" && r.error === "Cancelled"

export default function TranscribePage() {
  const { theme, toggle } = useTheme()

  const [storedKeys, setKeys] = useLocalStorage<Record<ProviderId, string>>(
    "routerdash:keys",
    EMPTY_KEYS,
  )
  // Keys saved before a provider existed are backfilled so every consumer can
  // call `.trim()` on `keys[provider]` without an undefined check.
  const keys = React.useMemo<Record<ProviderId, string>>(
    () => ({ ...EMPTY_KEYS, ...storedKeys }),
    [storedKeys],
  )
  const [selectedKeys, setSelectedKeys] = useLocalStorage<string[]>(
    "routerdash:stt-models",
    [],
  )
  const [language, setLanguage] = useLocalStorage<string>(
    "routerdash:stt-language",
    "",
  )

  const [storageWarning, setStorageWarning] = React.useState(false)
  const [storedSessions, setStoredSessions, sessionsHydrated] =
    useLocalStorage<TranscriptionSession[]>("routerdash:transcriptions", [], {
      onError: () => {
        setStorageWarning(true)
        toast.error("Browser storage is full — delete some sessions.")
      },
    })
  const sessions = React.useMemo(
    () => parseSessions(storedSessions),
    [storedSessions],
  )

  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const [results, setResults] = React.useState<Map<string, TranscriptResult>>(
    new Map(),
  )
  const [running, setRunning] = React.useState(false)
  const [elapsedMs, setElapsedMs] = React.useState(0)

  const abortRef = React.useRef<AbortController | null>(null)
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)

  // IndexedDB is only touched from effects and handlers, never during render.
  const audioStore = React.useMemo(() => createIndexedDbAudioStore(), [])

  const { models, modelByKey, providerStates, refreshProvider } =
    useSttCatalogs(keys)

  const stopTimer = React.useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])
  React.useEffect(() => stopTimer, [stopTimer])

  // Audio follows its session: when a session leaves the list (deleted,
  // cleared, or evicted by the limit) its stored audio is removed too. On the
  // first pass after load, also sweep audio whose session is already gone.
  const knownIdsRef = React.useRef<Set<string> | null>(null)
  React.useEffect(() => {
    if (!sessionsHydrated || !audioStore) return
    const ids = new Set(sessions.map((s) => s.id))
    if (knownIdsRef.current === null) {
      void removeOrphanedAudio(audioStore, ids).catch(() => {})
    } else {
      for (const id of knownIdsRef.current) {
        if (!ids.has(id)) void audioStore.delete(id).catch(() => {})
      }
    }
    knownIdsRef.current = ids
  }, [sessions, sessionsHydrated, audioStore])

  const saveKey = React.useCallback(
    (provider: ProviderId, key: string) =>
      setKeys((prev) => ({ ...prev, [provider]: key })),
    [setKeys],
  )
  const clearKey = React.useCallback(
    (provider: ProviderId) => {
      setKeys((prev) => ({ ...prev, [provider]: "" }))
      clearCatalogCache(provider)
      if (isSttProvider(provider)) clearSttCache(provider)
    },
    [setKeys],
  )

  const selectedModels = React.useMemo(
    () => selectedKeys.map((k) => resolveSttModel(k, modelByKey)),
    [selectedKeys, modelByKey],
  )
  const hasKeyedModel = selectedModels.some(
    (m) => isSttProvider(m.provider) && keys[m.provider].trim(),
  )
  const hasAnyKey = (["groq", "openrouter"] as const).some((p) =>
    keys[p].trim(),
  )
  const canRun = !!loaded?.blob && selectedKeys.length > 0 && hasKeyedModel

  const handleFile = React.useCallback(
    async (file: File) => {
      if (running) return
      const check = validateAudioFile(file)
      if (!check.ok) {
        toast.error(`${file.name}: ${check.reason}`)
        return
      }
      let durationMs: number
      try {
        durationMs = await readAudioDurationMs(file)
      } catch {
        toast.error(
          `${file.name}: this browser can't read that audio. Try mp3, wav or m4a.`,
        )
        return
      }
      if (durationMs > MAX_AUDIO_SECONDS * 1000) {
        toast.error(
          `${file.name}: longer than ${MAX_AUDIO_SECONDS / 60} minutes`,
        )
        return
      }
      const session = createSession(
        {
          blob: file,
          fileName: file.name,
          mimeType: file.type,
          durationMs,
          sizeBytes: file.size,
        },
        language,
      )
      setLoaded({ session, blob: file, persisted: false })
      setResults(new Map())
      setElapsedMs(0)
    },
    [running, language],
  )

  const handleCancel = React.useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** Save the session (and its audio, if new) after a run produced results. */
  const commitSession = React.useCallback(
    async (current: Loaded, finals: TranscriptResult[]) => {
      let merged = mergeResults(current.session, finals)
      merged = { ...merged, language: language || undefined }

      if (!current.persisted && current.blob && audioStore) {
        try {
          await audioStore.put(merged.id, current.blob)
          void requestPersistence()
          if (await isStorageNearlyFull()) {
            setStorageWarning(true)
            toast.warning("Browser storage is nearly full — delete old sessions.")
          }
        } catch {
          toast.warning(
            "Couldn't store the audio, so this session can't be replayed. Transcripts were saved.",
          )
        }
      }

      setStoredSessions((prev) => {
        const list = parseSessions(prev)
        const existing = list.find((s) => s.id === merged.id)
        const next = { ...merged, pinned: existing?.pinned ?? merged.pinned }
        return enforceLimit([next, ...list.filter((s) => s.id !== next.id)])
          .kept
      })
      setLoaded({ session: merged, blob: current.blob, persisted: true })
    },
    [audioStore, language, setStoredSessions],
  )

  const handleTranscribe = React.useCallback(async () => {
    if (!loaded?.blob) {
      toast.error("Add an audio file first")
      return
    }
    if (!hasAnyKey) {
      toast.error("Add a Groq or OpenRouter API key first")
      return
    }
    if (selectedKeys.length === 0) {
      toast.error("Select at least one model")
      return
    }

    const current = loaded
    const audio: AudioInput = {
      blob: current.blob!,
      fileName: current.session.fileName,
      mimeType: current.session.mimeType,
      durationMs: current.session.durationMs,
    }
    const runModels = selectedKeys.map((k) => resolveSttModel(k, modelByKey))
    const baseline = new Map(
      current.session.results.map((r) => [r.modelKey, r]),
    )

    const controller = new AbortController()
    abortRef.current = controller
    setRunning(true)
    trackEvent("transcription_started", {
      modelIds: selectedKeys.join(","),
      modelCount: selectedKeys.length,
      source: "upload",
    })

    setResults((prev) => {
      const next = new Map(prev)
      for (const m of runModels) {
        next.set(m.key, {
          modelKey: m.key,
          status: "running",
          text: "",
          latencyMs: 0,
          usage: null,
          cost: 0,
          runAt: Date.now(),
        })
      }
      return next
    })

    const start = performance.now()
    setElapsedMs(0)
    stopTimer()
    timerRef.current = setInterval(
      () => setElapsedMs(performance.now() - start),
      100,
    )

    const finals = await runTranscription({
      models: runModels,
      audio,
      keys,
      language: language || undefined,
      signal: controller.signal,
      onResult: (r) => setResults((prev) => new Map(prev).set(r.modelKey, r)),
    })

    stopTimer()
    const totalElapsed = performance.now() - start
    setElapsedMs(totalElapsed)
    setRunning(false)
    abortRef.current = null

    // A cancelled model has nothing new to show: put back what it had before.
    const cancelled = finals.filter(isCancelled)
    if (cancelled.length > 0) {
      setResults((prev) => {
        const next = new Map(prev)
        for (const r of cancelled) {
          const old = baseline.get(r.modelKey)
          if (old) next.set(r.modelKey, old)
          else next.delete(r.modelKey)
        }
        return next
      })
    }

    const kept = finals.filter((r) => !isCancelled(r))
    const doneCount = kept.filter((r) => r.status === "done").length
    if (doneCount > 0) {
      trackEvent("transcription_completed", {
        modelCount: runModels.length,
        durationMs: Math.round(totalElapsed),
        source: "upload",
      })
    } else if (kept.length > 0) {
      trackEvent("transcription_failed", {
        modelCount: runModels.length,
        errorCategory: categorizeError(kept[0].error),
        source: "upload",
      })
    }
    if (kept.length > 0) await commitSession(current, kept)
  }, [
    loaded,
    hasAnyKey,
    selectedKeys,
    modelByKey,
    keys,
    language,
    stopTimer,
    commitSession,
  ])

  const loadSession = React.useCallback(
    async (session: TranscriptionSession) => {
      if (running) handleCancel()
      let blob: Blob | null = null
      try {
        blob = audioStore ? await audioStore.get(session.id) : null
      } catch {
        blob = null
      }
      setLoaded({ session, blob, persisted: true })
      setResults(new Map(session.results.map((r) => [r.modelKey, r])))
      setElapsedMs(0)
      if (!blob) {
        toast.warning("The audio for this session is no longer stored here")
      }
      window.scrollTo({ top: 0, behavior: "smooth" })
    },
    [running, handleCancel, audioStore],
  )

  const deleteSession = React.useCallback(
    (id: string) => {
      setStoredSessions((prev) => parseSessions(prev).filter((s) => s.id !== id))
      // Keep what's on screen, but it is no longer saved.
      setLoaded((cur) =>
        cur && cur.session.id === id ? { ...cur, persisted: false } : cur,
      )
    },
    [setStoredSessions],
  )

  const clearSessions = React.useCallback(() => {
    setStoredSessions([])
    setLoaded((cur) => (cur ? { ...cur, persisted: false } : cur))
    toast.success("Sessions and their audio deleted")
  }, [setStoredSessions])

  const togglePin = React.useCallback(
    (id: string) =>
      setStoredSessions((prev) =>
        parseSessions(prev).map((s) =>
          s.id === id ? { ...s, pinned: !s.pinned } : s,
        ),
      ),
    [setStoredSessions],
  )

  const connectedCount = (["groq", "openrouter"] as const).filter((p) =>
    keys[p].trim(),
  ).length
  const rerun = loaded?.persisted ?? false

  return (
    <div className="min-h-svh bg-background">
      <Header
        theme={theme}
        onToggleTheme={toggle}
        historySlot={
          <SessionsSheet
            sessions={sessions}
            activeId={loaded?.persisted ? loaded.session.id : null}
            storageWarning={storageWarning}
            onSelect={loadSession}
            onDelete={deleteSession}
            onClear={clearSessions}
            onTogglePin={togglePin}
          />
        }
        keySlot={
          <ApiKeyDialog keys={keys} onSave={saveKey} onClear={clearKey} />
        }
      />

      <main className="mx-auto flex max-w-[1600px] flex-col gap-4 px-4 py-5">
        <section className="grid-dots rounded-2xl border border-border bg-card/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <LayersIcon className="size-4 text-primary" />
            <h1 className="text-sm font-semibold">
              {selectedKeys.length} model
              {selectedKeys.length === 1 ? "" : "s"} selected
            </h1>
          </div>
          <SttModelPicker
            models={models}
            modelByKey={modelByKey}
            providerStates={providerStates}
            selectedKeys={selectedKeys}
            onChange={setSelectedKeys}
            onRefresh={refreshProvider}
          />
        </section>

        {loaded ? (
          <SessionPlayer
            fileName={loaded.session.fileName}
            sizeBytes={loaded.session.sizeBytes}
            durationMs={loaded.session.durationMs}
            blob={loaded.blob}
            actions={<AudioDropzone compact onFile={handleFile} disabled={running} />}
          />
        ) : (
          <AudioDropzone onFile={handleFile} />
        )}

        {loaded && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Language
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={running}
                aria-label="Spoken language"
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
              >
                {TRANSCRIPTION_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-popover">
                    {l.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center gap-3">
              {running && (
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  <Loader2Icon className="size-3.5 animate-spin" />
                  {formatLatency(elapsedMs)}
                </span>
              )}
              {running ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleCancel}
                  className="gap-1.5"
                >
                  <SquareIcon data-icon="inline-start" className="fill-current" />
                  Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleTranscribe}
                  disabled={!canRun}
                  className="gap-1.5"
                >
                  <PlayIcon data-icon="inline-start" className="fill-current" />
                  {rerun ? "Re-transcribe" : "Transcribe"}
                </Button>
              )}
            </div>
          </div>
        )}

        {results.size > 0 && loaded ? (
          <TranscriptGrid
            results={results}
            modelByKey={modelByKey}
            durationMs={loaded.session.durationMs}
          />
        ) : (
          <EmptyState
            hasAudio={!!loaded}
            hasSelection={selectedKeys.length > 0}
            hasKey={connectedCount > 0}
          />
        )}
      </main>

      <SiteFooter />
    </div>
  )
}

function EmptyState({
  hasAudio,
  hasSelection,
  hasKey,
}: {
  hasAudio: boolean
  hasSelection: boolean
  hasKey: boolean
}) {
  const message = !hasKey
    ? "Add a Groq or OpenRouter API key, pick a few models, and add an audio file to compare their transcripts."
    : !hasSelection
      ? "Select the models you want to compare, then transcribe your audio."
      : !hasAudio
        ? "Add an audio file above to send it to every selected model at once."
        : "Hit Transcribe to send the audio to every selected model."
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-card/40 px-6 py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <AudioLinesIcon className="size-6" />
      </div>
      <h2 className="text-base font-semibold">Ready to transcribe</h2>
      <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
        {message}
      </p>
    </div>
  )
}
