/**
 * OpenRouter speech-to-text. There is no dedicated transcription endpoint, so
 * this sends the audio to a chat model that accepts audio input and asks for a
 * verbatim transcript. Because these are LLMs, some paraphrasing or added
 * commentary is possible, which is exactly the kind of difference worth
 * measuring against Whisper.
 */

import type { ChatMessage, UnifiedModel } from "@/lib/providers/types"
import { supportsParam } from "@/lib/providers/types"
import { OPENROUTER_BASE } from "@/lib/providers/openrouter"
import { postChatCompletion } from "@/lib/providers/openai-compat"
import { bytesToBase64, blobToWav16k } from "@/lib/audio/wav"
import { audioExtension } from "@/lib/audio/validate"
import { loadCatalog } from "@/lib/providers"
import {
  supportsAudioInput,
  type AudioInput,
  type SttAdapter,
  type TranscriptionOutcome,
} from "./types"

const SYSTEM_PROMPT =
  "You are a speech transcription engine. Output only a verbatim transcript of the audio, with no commentary, speaker labels, timestamps, or formatting."

export interface AudioPart {
  data: string
  format: string
}

/**
 * Formats every OpenRouter audio model is documented to take; anything else is
 * converted to WAV in the browser.
 */
const NATIVE_FORMATS = ["wav", "mp3"] as const

export function nativeAudioFormat(audio: {
  fileName: string
  mimeType: string
}): (typeof NATIVE_FORMATS)[number] | null {
  const ext = audioExtension(audio.fileName)
  if (ext === "wav" || ext === "mp3") return ext
  const mime = audio.mimeType.toLowerCase()
  if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave")
    return "wav"
  if (mime === "audio/mpeg" || mime === "audio/mp3") return "mp3"
  return null
}

// Concurrent models share one conversion/encoding of the same blob per run.
const partCache = new WeakMap<Blob, Promise<AudioPart>>()

export function prepareAudioPart(audio: AudioInput): Promise<AudioPart> {
  const cached = partCache.get(audio.blob)
  if (cached) return cached
  const promise = (async (): Promise<AudioPart> => {
    const format = nativeAudioFormat(audio)
    if (format) {
      const bytes = new Uint8Array(await audio.blob.arrayBuffer())
      return { data: bytesToBase64(bytes), format }
    }
    return { data: bytesToBase64(await blobToWav16k(audio.blob)), format: "wav" }
  })()
  partCache.set(audio.blob, promise)
  // Don't keep a failed conversion cached; a retry should try again.
  promise.catch(() => partCache.delete(audio.blob))
  return promise
}

/** Build the chat messages for a transcription request. Exported for tests. */
export function buildTranscriptionMessages(
  part: AudioPart,
  language?: string,
): ChatMessage[] {
  const instruction = language
    ? `Transcribe this audio. The language code is "${language}".`
    : "Transcribe this audio."
  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: instruction },
        { type: "input_audio", input_audio: part },
      ],
    },
  ]
}

async function listModels(
  _apiKey: string,
  signal?: AbortSignal,
): Promise<UnifiedModel[]> {
  const models = await loadCatalog("openrouter", "", { signal })
  return models.filter(supportsAudioInput)
}

async function transcribe(
  apiKey: string,
  model: UnifiedModel,
  audio: AudioInput,
  opts: { language?: string },
  signal?: AbortSignal,
): Promise<TranscriptionOutcome> {
  const part = await prepareAudioPart(audio)
  const body: Record<string, unknown> = {}
  if (supportsParam(model, "temperature")) body.temperature = 0

  const { content, usage } = await postChatCompletion({
    provider: "openrouter",
    url: `${OPENROUTER_BASE}/chat/completions`,
    apiKey,
    model: model.modelId,
    messages: buildTranscriptionMessages(part, opts.language),
    body,
    extraHeaders: {
      "HTTP-Referer":
        typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "RouterDash",
    },
    signal,
  })
  return { text: content.trim(), usage }
}

export const openRouterSttAdapter: SttAdapter = {
  provider: "openrouter",
  listModels,
  transcribe,
}
