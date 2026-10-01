/**
 * Groq speech-to-text: Whisper via the OpenAI-compatible
 * `/audio/transcriptions` endpoint (multipart upload of the original file).
 */

import type { UnifiedModel } from "@/lib/providers/types"
import { GROQ_BASE, fetchGroqModels, normalizeGroqModel } from "@/lib/providers/groq"
import { extractErrorMessage } from "@/lib/providers/openai-compat"
import {
  providerErrorFromResponse,
  providerErrorFromThrown,
} from "@/lib/providers/errors"
import type {
  SttAdapter,
  TranscriptSegment,
  TranscriptionOutcome,
} from "./types"

/** The chat catalog filters Whisper out; this is the inverse. */
export function isGroqSttModelId(id: string): boolean {
  const lower = id.toLowerCase()
  return lower.includes("whisper") && !lower.includes("guard")
}

async function listModels(
  apiKey: string,
  signal?: AbortSignal,
): Promise<UnifiedModel[]> {
  const data = await fetchGroqModels(apiKey, signal)
  return data
    .filter((m) => m.active !== false && isGroqSttModelId(m.id))
    .map(normalizeGroqModel)
}

/** Parse Groq's `verbose_json` body. Exported for tests. */
export function parseGroqTranscription(json: unknown): TranscriptionOutcome {
  const j = (json ?? {}) as Record<string, unknown>
  const text = typeof j.text === "string" ? j.text.trim() : ""
  const segments: TranscriptSegment[] = []
  if (Array.isArray(j.segments)) {
    for (const raw of j.segments) {
      const s = (raw ?? {}) as Record<string, unknown>
      if (typeof s.text !== "string") continue
      segments.push({
        text: s.text.trim(),
        startMs: Math.round((Number(s.start) || 0) * 1000),
        endMs: Math.round((Number(s.end) || 0) * 1000),
      })
    }
  }
  return { text, segments: segments.length ? segments : undefined, usage: null }
}

async function transcribe(
  apiKey: string,
  model: UnifiedModel,
  audio: { blob: Blob; fileName: string },
  opts: { language?: string },
  signal?: AbortSignal,
): Promise<TranscriptionOutcome> {
  const form = new FormData()
  form.append("file", audio.blob, audio.fileName)
  form.append("model", model.modelId)
  form.append("response_format", "verbose_json")
  form.append("temperature", "0")
  if (opts.language) form.append("language", opts.language)

  let res: Response
  try {
    res = await fetch(`${GROQ_BASE}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal,
    })
  } catch (err) {
    // AbortError propagates as-is so callers can detect cancellation.
    if (err instanceof DOMException && err.name === "AbortError") throw err
    throw providerErrorFromThrown("groq", err)
  }

  const raw = await res.text()
  let json: unknown = null
  try {
    json = raw ? JSON.parse(raw) : null
  } catch {
    json = null
  }
  if (!res.ok) {
    throw providerErrorFromResponse({
      provider: "groq",
      status: res.status,
      rawMessage: extractErrorMessage(json) ?? raw ?? "",
    })
  }
  return parseGroqTranscription(json)
}

export const groqSttAdapter: SttAdapter = {
  provider: "groq",
  listModels,
  transcribe,
}
