/**
 * Pure helpers for transcription sessions: creation, merging re-transcribe
 * results, defensive parsing of stored data, and eviction. No React or
 * storage access here, so everything is unit-testable.
 */

import type { RunStatus } from "@/lib/types"
import {
  TRANSCRIPTION_LIMIT,
  type AudioInput,
  type TranscriptResult,
  type TranscriptionSession,
} from "./types"

export function newSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function createSession(
  audio: AudioInput & { sizeBytes: number },
  language?: string,
  now: number = Date.now(),
): TranscriptionSession {
  return {
    id: newSessionId(),
    createdAt: now,
    fileName: audio.fileName,
    mimeType: audio.mimeType,
    sizeBytes: audio.sizeBytes,
    durationMs: audio.durationMs,
    language: language || undefined,
    results: [],
  }
}

/**
 * Merge new results into a session. A result replaces the earlier one for the
 * same model (re-transcribing with a model supersedes its old transcript);
 * results for other models are kept. Order of first appearance is preserved.
 */
export function mergeResults(
  session: TranscriptionSession,
  incoming: TranscriptResult[],
): TranscriptionSession {
  const byKey = new Map(session.results.map((r) => [r.modelKey, r]))
  for (const r of incoming) byKey.set(r.modelKey, r)
  return { ...session, results: Array.from(byKey.values()) }
}

/**
 * Keep pinned sessions plus as many unpinned ones (newest first) as fit under
 * the limit. Returns what was dropped so the caller can delete its audio.
 */
export function enforceLimit(
  sessions: TranscriptionSession[],
  limit: number = TRANSCRIPTION_LIMIT,
): { kept: TranscriptionSession[]; evicted: TranscriptionSession[] } {
  const pinned = sessions.filter((s) => s.pinned)
  const unpinned = sessions.filter((s) => !s.pinned)
  const room = Math.max(0, limit - pinned.length)
  return {
    kept: [...pinned, ...unpinned.slice(0, room)],
    evicted: unpinned.slice(room),
  }
}

const STATUSES: readonly RunStatus[] = [
  "idle",
  "running",
  "done",
  "error",
  "skipped",
]

function parseResult(raw: unknown): TranscriptResult | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.modelKey !== "string") return null
  // A result persisted mid-run can never complete, so don't resurrect it as
  // "running" after a reload.
  const status = STATUSES.includes(r.status as RunStatus)
    ? (r.status as RunStatus)
    : "error"
  return {
    modelKey: r.modelKey,
    status: status === "running" ? "error" : status,
    text: typeof r.text === "string" ? r.text : "",
    segments: Array.isArray(r.segments)
      ? (r.segments as TranscriptResult["segments"])
      : undefined,
    latencyMs: Number(r.latencyMs) || 0,
    usage: (r.usage as TranscriptResult["usage"]) ?? null,
    cost: Number(r.cost) || 0,
    error:
      typeof r.error === "string"
        ? r.error
        : status === "running"
          ? "Interrupted"
          : undefined,
    runAt: Number(r.runAt) || 0,
  }
}

/** Validate whatever came out of localStorage; drop anything malformed. */
export function parseSessions(raw: unknown): TranscriptionSession[] {
  if (!Array.isArray(raw)) return []
  const out: TranscriptionSession[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const s = item as Record<string, unknown>
    if (typeof s.id !== "string" || typeof s.fileName !== "string") continue
    out.push({
      id: s.id,
      createdAt: Number(s.createdAt) || 0,
      fileName: s.fileName,
      mimeType: typeof s.mimeType === "string" ? s.mimeType : "",
      sizeBytes: Number(s.sizeBytes) || 0,
      durationMs: Number(s.durationMs) || 0,
      language: typeof s.language === "string" ? s.language : undefined,
      pinned: s.pinned === true ? true : undefined,
      results: Array.isArray(s.results)
        ? s.results.map(parseResult).filter((r): r is TranscriptResult => !!r)
        : [],
    })
  }
  return out
}

/** Real-time factor: processing time ÷ audio length. Below 1 is faster than real time. */
export function realtimeFactor(
  latencyMs: number,
  durationMs: number,
): number | null {
  if (!latencyMs || !durationMs) return null
  return latencyMs / durationMs
}

export function wordCount(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}
