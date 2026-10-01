/**
 * Fan one audio file out to every selected model in parallel. Each model is
 * timed and fails independently; a rate-limited or erroring model never delays
 * or cancels the others. Mirrors the parallel pattern of `handleRun` in
 * app/page.tsx.
 */

import {
  ADAPTERS,
  estimateCost,
  type ProviderId,
  type UnifiedModel,
} from "@/lib/providers"
import type { AudioInput, TranscriptResult } from "./types"
import { isSttProvider } from "./types"
import { STT_ADAPTERS } from "./adapters"

export interface RunTranscriptionArgs {
  models: UnifiedModel[]
  audio: AudioInput
  keys: Record<ProviderId, string>
  language?: string
  signal: AbortSignal
  /** Called as each model settles, so the UI can fill in progressively. */
  onResult?: (result: TranscriptResult) => void
}

function failure(
  model: UnifiedModel,
  error: string,
  latencyMs = 0,
): TranscriptResult {
  return {
    modelKey: model.key,
    status: "error",
    text: "",
    latencyMs,
    usage: null,
    cost: 0,
    error,
    runAt: Date.now(),
  }
}

export async function runTranscription(
  args: RunTranscriptionArgs,
): Promise<TranscriptResult[]> {
  const { models, audio, keys, language, signal, onResult } = args

  return Promise.all(
    models.map(async (model): Promise<TranscriptResult> => {
      const emit = (r: TranscriptResult) => {
        onResult?.(r)
        return r
      }

      if (!isSttProvider(model.provider)) {
        return emit(
          failure(
            model,
            `${ADAPTERS[model.provider].label} has no transcription models here`,
          ),
        )
      }
      const apiKey = keys[model.provider]?.trim() ?? ""
      if (!apiKey) {
        return emit(
          failure(
            model,
            `Add your ${ADAPTERS[model.provider].label} key to run this model`,
          ),
        )
      }

      const t0 = performance.now()
      try {
        const outcome = await STT_ADAPTERS[model.provider].transcribe(
          apiKey,
          model,
          audio,
          { language },
          signal,
        )
        return emit({
          modelKey: model.key,
          status: "done",
          text: outcome.text,
          segments: outcome.segments,
          latencyMs: performance.now() - t0,
          usage: outcome.usage,
          cost: estimateCost(model, outcome.usage),
          runAt: Date.now(),
        })
      } catch (err) {
        const aborted =
          signal.aborted ||
          (err instanceof DOMException && err.name === "AbortError")
        return emit(
          failure(
            model,
            aborted
              ? "Cancelled"
              : // ProviderError.message is a pre-sanitized, credential-free summary.
                err instanceof Error
                ? err.message
                : "Request failed",
            performance.now() - t0,
          ),
        )
      }
    }),
  )
}
