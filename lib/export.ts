import { APP_VERSION, type HistoryEntry, type RunState, type RunStatus } from "@/lib/types"
import type { RunParams } from "@/lib/openrouter"

/** Reject oversized import files early (2 MB is generous for JSON history). */
export const MAX_IMPORT_BYTES = 2_000_000

const EXPORT_KIND = "routerdash.benchmark-export"
const EXPORT_VERSION = 1

export interface ExportEnvelope {
  kind: typeof EXPORT_KIND
  version: number
  appVersion: string
  exportedAt: string
  entries: HistoryEntry[]
}

/**
 * Build the JSON export envelope. HistoryEntry never carries an API key, so
 * keys can never be included; we deep-strip anyway as defense in depth.
 */
export function buildJsonExport(entries: HistoryEntry[]): ExportEnvelope {
  return {
    kind: EXPORT_KIND,
    version: EXPORT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    entries: entries.map(stripEntry),
  }
}

/** Remove any unexpected/sensitive keys, keeping only the known schema fields. */
function stripEntry(entry: HistoryEntry): HistoryEntry {
  return {
    id: entry.id,
    createdAt: entry.createdAt,
    prompt: entry.prompt,
    images: entry.images,
    params: entry.params,
    modelIds: entry.modelIds,
    results: entry.results.map((r) => ({
      modelId: r.modelId,
      status: r.status,
      content: r.content,
      error: r.error,
      usage: r.usage,
      cost: r.cost,
      latencyMs: r.latencyMs,
    })),
    elapsedMs: entry.elapsedMs,
    totalCost: entry.totalCost,
    pinned: entry.pinned,
  }
}

export function serializeJsonExport(entries: HistoryEntry[]): string {
  return JSON.stringify(buildJsonExport(entries), null, 2)
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Escape a single CSV field per RFC 4180. */
export function escapeCsvField(value: string | number): string {
  const s = String(value ?? "")
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const CSV_COLUMNS = [
  "timestamp",
  "prompt",
  "image_count",
  "models",
  "model_count",
  "elapsed_ms",
  "total_cost_usd",
  "prompt_tokens",
  "completion_tokens",
  "done_count",
  "error_count",
] as const

/**
 * CSV summary of history. Excludes full response bodies for clean tabular
 * output; includes metadata, timing, and aggregate scores.
 */
export function buildCsvExport(entries: HistoryEntry[]): string {
  const rows: string[] = [CSV_COLUMNS.join(",")]

  for (const entry of entries) {
    const done = entry.results.filter((r) => r.status === "done")
    const errored = entry.results.filter((r) => r.status === "error")
    const promptTokens = entry.results.reduce(
      (a, r) => a + (r.usage?.prompt_tokens ?? 0),
      0,
    )
    const completionTokens = entry.results.reduce(
      (a, r) => a + (r.usage?.completion_tokens ?? 0),
      0,
    )
    const row = [
      new Date(entry.createdAt).toISOString(),
      entry.prompt,
      entry.images?.length ?? 0,
      entry.modelIds.join(" | "),
      entry.modelIds.length,
      Math.round(entry.elapsedMs),
      entry.totalCost.toFixed(6),
      promptTokens,
      completionTokens,
      done.length,
      errored.length,
    ]
    rows.push(row.map(escapeCsvField).join(","))
  }

  return rows.join("\r\n")
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportResult =
  | {
      ok: true
      entries: HistoryEntry[]
      imported: number
      duplicates: number
    }
  | { ok: false; reason: string }

const VALID_STATUSES: RunStatus[] = [
  "idle",
  "running",
  "done",
  "error",
  "skipped",
]

function isRunParams(v: unknown): v is RunParams {
  if (typeof v !== "object" || v === null) return false
  const p = v as Record<string, unknown>
  return (
    typeof p.systemPrompt === "string" &&
    typeof p.temperature === "number" &&
    typeof p.topP === "number" &&
    typeof p.maxTokens === "number"
  )
}

function isRunState(v: unknown): v is RunState {
  if (typeof v !== "object" || v === null) return false
  const r = v as Record<string, unknown>
  const usageOk =
    r.usage === null ||
    (typeof r.usage === "object" &&
      r.usage !== null &&
      typeof (r.usage as Record<string, unknown>).total_tokens === "number")
  return (
    typeof r.modelId === "string" &&
    typeof r.status === "string" &&
    VALID_STATUSES.includes(r.status as RunStatus) &&
    typeof r.content === "string" &&
    usageOk &&
    typeof r.cost === "number" &&
    typeof r.latencyMs === "number"
  )
}

function isPromptImageArray(v: unknown): boolean {
  if (v === undefined) return true
  if (!Array.isArray(v)) return false
  return v.every((img) => {
    if (typeof img !== "object" || img === null) return false
    const i = img as Record<string, unknown>
    return (
      typeof i.id === "string" &&
      typeof i.dataUrl === "string" &&
      typeof i.mimeType === "string" &&
      typeof i.name === "string" &&
      typeof i.sizeBytes === "number"
    )
  })
}

export function isHistoryEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== "object" || v === null) return false
  const e = v as Record<string, unknown>
  return (
    typeof e.id === "string" &&
    typeof e.createdAt === "number" &&
    typeof e.prompt === "string" &&
    isPromptImageArray(e.images) &&
    isRunParams(e.params) &&
    Array.isArray(e.modelIds) &&
    e.modelIds.every((m) => typeof m === "string") &&
    Array.isArray(e.results) &&
    e.results.every(isRunState) &&
    typeof e.elapsedMs === "number" &&
    typeof e.totalCost === "number"
  )
}

/**
 * Parse + validate an exported JSON file and merge it against existing entries.
 * Rejects malformed files, oversized files, and de-duplicates by entry id.
 */
export function parseJsonImport(
  text: string,
  existing: HistoryEntry[],
): ImportResult {
  if (text.length > MAX_IMPORT_BYTES) {
    return {
      ok: false,
      reason: `File is too large (max ${(MAX_IMPORT_BYTES / 1_000_000).toFixed(0)} MB)`,
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: "File is not valid JSON" }
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "Unexpected file structure" }
  }
  const env = parsed as Record<string, unknown>
  if (env.kind !== EXPORT_KIND) {
    return {
      ok: false,
      reason: "Not a RouterDash export file",
    }
  }
  if (!Array.isArray(env.entries)) {
    return { ok: false, reason: "Export is missing its entries list" }
  }

  const valid: HistoryEntry[] = []
  for (const item of env.entries) {
    if (!isHistoryEntry(item)) {
      return {
        ok: false,
        reason: "One or more benchmark entries are malformed",
      }
    }
    valid.push(item)
  }

  const existingIds = new Set(existing.map((e) => e.id))
  const fresh = valid.filter((e) => !existingIds.has(e.id))
  const duplicates = valid.length - fresh.length

  return {
    ok: true,
    entries: fresh,
    imported: fresh.length,
    duplicates,
  }
}

/** Trigger a client-side file download for the given text content. */
export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
