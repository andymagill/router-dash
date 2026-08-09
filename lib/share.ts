import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string"
import type { RunParams } from "@/lib/openrouter"
import type { HistoryEntry, RunState, RunStatus } from "@/lib/types"

/** Query-string key that carries a shared benchmark payload. */
export const SHARE_PARAM = "s"

/**
 * Practical ceiling for the whole shared URL. Most browsers and servers accept
 * far more, but we stay conservative so links survive chat apps and redirects.
 * When the full payload (with response bodies) exceeds this, we drop the bodies.
 */
export const SHARE_URL_BUDGET = 12_000

const SHARE_VERSION = 1

/** A single model's result as embedded in a share link. Never contains keys. */
export interface SharedResult {
  modelId: string
  status: RunStatus
  content: string
  error?: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost: number
  latencyMs: number
}

export interface SharePayload {
  v: number
  prompt: string
  params: RunParams
  modelIds: string[]
  results: SharedResult[]
  /** True when response bodies were stripped to fit the URL budget. */
  truncated?: boolean
}

function toSharedResult(run: RunState, includeContent: boolean): SharedResult {
  return {
    modelId: run.modelId,
    status: run.status,
    content: includeContent ? run.content : "",
    error: run.error,
    promptTokens: run.usage?.prompt_tokens ?? 0,
    completionTokens: run.usage?.completion_tokens ?? 0,
    totalTokens: run.usage?.total_tokens ?? 0,
    cost: run.cost,
    latencyMs: run.latencyMs,
  }
}

/** Rehydrate a shared result back into the app's RunState shape. */
export function sharedResultToRunState(r: SharedResult): RunState {
  return {
    modelId: r.modelId,
    status: r.status,
    content: r.content,
    error: r.error,
    usage:
      r.totalTokens || r.promptTokens || r.completionTokens
        ? {
            prompt_tokens: r.promptTokens,
            completion_tokens: r.completionTokens,
            total_tokens: r.totalTokens,
          }
        : null,
    cost: r.cost,
    latencyMs: r.latencyMs,
  }
}

/**
 * Build a shareable payload from live workbench state. API keys are never part
 * of the RunState/RunParams shapes, so they can never leak here.
 */
export function buildSharePayload(
  prompt: string,
  params: RunParams,
  modelIds: string[],
  results: RunState[],
  includeContent = true,
): SharePayload {
  return {
    v: SHARE_VERSION,
    prompt,
    params,
    modelIds,
    results: results.map((r) => toSharedResult(r, includeContent)),
  }
}

/** Compress a payload into a URL-safe token. */
export function encodeSharePayload(payload: SharePayload): string {
  return compressToEncodedURIComponent(JSON.stringify(payload))
}

/**
 * Produce a full share URL for the given origin+path. If the encoded payload
 * with response bodies would exceed the budget, retries without bodies and
 * marks the payload truncated so the UI can warn the recipient.
 */
export function buildShareUrl(
  baseUrl: string,
  prompt: string,
  params: RunParams,
  modelIds: string[],
  results: RunState[],
): { url: string; truncated: boolean } {
  const full = buildSharePayload(prompt, params, modelIds, results, true)
  let token = encodeSharePayload(full)
  let truncated = false

  if (token.length + baseUrl.length + SHARE_PARAM.length + 2 > SHARE_URL_BUDGET) {
    const slim = buildSharePayload(prompt, params, modelIds, results, false)
    slim.truncated = true
    token = encodeSharePayload(slim)
    truncated = true
  }

  const sep = baseUrl.includes("?") ? "&" : "?"
  return {
    url: `${baseUrl}${sep}${SHARE_PARAM}=${token}`,
    truncated,
  }
}

export type DecodeResult =
  | { ok: true; payload: SharePayload }
  | { ok: false; reason: string }

const VALID_STATUSES: RunStatus[] = ["idle", "running", "done", "error"]

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

function isSharedResult(v: unknown): v is SharedResult {
  if (typeof v !== "object" || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.modelId === "string" &&
    typeof r.status === "string" &&
    VALID_STATUSES.includes(r.status as RunStatus) &&
    typeof r.content === "string" &&
    typeof r.promptTokens === "number" &&
    typeof r.completionTokens === "number" &&
    typeof r.totalTokens === "number" &&
    typeof r.cost === "number" &&
    typeof r.latencyMs === "number"
  )
}

/** Validate an unknown object against the SharePayload shape. */
export function validateSharePayload(value: unknown): DecodeResult {
  if (typeof value !== "object" || value === null) {
    return { ok: false, reason: "Payload is not an object" }
  }
  const p = value as Record<string, unknown>
  if (typeof p.v !== "number") {
    return { ok: false, reason: "Missing version" }
  }
  if (typeof p.prompt !== "string") {
    return { ok: false, reason: "Missing or invalid prompt" }
  }
  if (!isRunParams(p.params)) {
    return { ok: false, reason: "Invalid parameters" }
  }
  if (
    !Array.isArray(p.modelIds) ||
    !p.modelIds.every((m) => typeof m === "string")
  ) {
    return { ok: false, reason: "Invalid model selection" }
  }
  if (!Array.isArray(p.results) || !p.results.every(isSharedResult)) {
    return { ok: false, reason: "Invalid results" }
  }
  return { ok: true, payload: value as unknown as SharePayload }
}

/** Decompress + validate a share token. */
export function decodeShareToken(token: string): DecodeResult {
  if (!token) return { ok: false, reason: "Empty share token" }
  let json: string | null
  try {
    json = decompressFromEncodedURIComponent(token)
  } catch {
    return { ok: false, reason: "Could not decompress share link" }
  }
  if (!json) {
    return { ok: false, reason: "Share link is corrupted or truncated" }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, reason: "Share link contains invalid data" }
  }
  return validateSharePayload(parsed)
}

/** Convenience: build a share URL directly from a stored history entry. */
export function buildShareUrlFromEntry(
  baseUrl: string,
  entry: HistoryEntry,
): { url: string; truncated: boolean } {
  return buildShareUrl(
    baseUrl,
    entry.prompt,
    entry.params,
    entry.modelIds,
    entry.results,
  )
}
