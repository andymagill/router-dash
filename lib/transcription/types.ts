/**
 * Speech-to-text types. Transcription reuses the app's existing providers and
 * keys (Groq and OpenRouter) and the composite `${provider}:${modelId}` model
 * keys, so nothing here introduces a new identity or credential scheme.
 */

import type { ORUsage, ProviderId, UnifiedModel } from "@/lib/providers/types"
import type { RunStatus } from "@/lib/types"

/** Providers that can transcribe audio today. */
export type SttProviderId = Extract<ProviderId, "groq" | "openrouter">

export const STT_PROVIDER_ORDER: readonly SttProviderId[] = [
  "groq",
  "openrouter",
]

export function isSttProvider(provider: ProviderId): provider is SttProviderId {
  return (STT_PROVIDER_ORDER as readonly string[]).includes(provider)
}

/** An audio file ready to send. The same blob is shared by every model. */
export interface AudioInput {
  blob: Blob
  fileName: string
  mimeType: string
  durationMs: number
}

export interface TranscriptSegment {
  text: string
  startMs: number
  endMs: number
}

export interface TranscriptionOutcome {
  text: string
  segments?: TranscriptSegment[]
  usage: ORUsage | null
}

export interface SttAdapter {
  provider: SttProviderId
  listModels(apiKey: string, signal?: AbortSignal): Promise<UnifiedModel[]>
  transcribe(
    apiKey: string,
    model: UnifiedModel,
    audio: AudioInput,
    opts: { language?: string },
    signal?: AbortSignal,
  ): Promise<TranscriptionOutcome>
}

// ---------------------------------------------------------------------------
// Persisted session shapes
// ---------------------------------------------------------------------------

export interface TranscriptResult {
  modelKey: string
  status: RunStatus
  text: string
  segments?: TranscriptSegment[]
  latencyMs: number
  usage: ORUsage | null
  cost: number
  error?: string
  runAt: number
}

/** Metadata only; the audio itself lives in IndexedDB under `id`. */
export interface TranscriptionSession {
  id: string
  createdAt: number
  fileName: string
  mimeType: string
  sizeBytes: number
  durationMs: number
  language?: string
  /** Pinned sessions are kept at the top and are never evicted by the limit. */
  pinned?: boolean
  results: TranscriptResult[]
}

export const TRANSCRIPTION_LIMIT = 25
export const MAX_STT_MODELS = 6

/** ISO-639-1 codes accepted by Whisper; empty means auto-detect. */
export const TRANSCRIPTION_LANGUAGES: { code: string; label: string }[] = [
  { code: "", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
  { code: "nl", label: "Dutch" },
  { code: "hi", label: "Hindi" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
]

/** Whether a catalog model is known to accept audio input (OpenRouter). */
export function supportsAudioInput(model: UnifiedModel): boolean {
  return model.inputModalities?.includes("audio") ?? false
}
