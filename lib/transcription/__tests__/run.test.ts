import { describe, expect, it, vi } from "vitest"
import type { ProviderId, UnifiedModel } from "@/lib/providers/types"
import type { SttAdapter, TranscriptResult } from "../types"

const { groqTranscribe, openrouterTranscribe } = vi.hoisted(() => ({
  groqTranscribe: vi.fn(),
  openrouterTranscribe: vi.fn(),
}))

vi.mock("../adapters", () => ({
  STT_ADAPTERS: {
    groq: { provider: "groq", listModels: vi.fn(), transcribe: groqTranscribe },
    openrouter: {
      provider: "openrouter",
      listModels: vi.fn(),
      transcribe: openrouterTranscribe,
    },
  } satisfies Record<string, SttAdapter>,
}))

import { runTranscription } from "../run"

const mk = (provider: ProviderId, modelId: string): UnifiedModel => ({
  key: `${provider}:${modelId}`,
  provider,
  modelId,
  name: modelId,
  vendor: "x",
  contextKnown: false,
  pricingKnown: true,
  promptPrice: "0.001",
  completionPrice: "0.002",
  isFree: false,
})

const audio = {
  blob: new Blob(["x"]),
  fileName: "a.mp3",
  mimeType: "audio/mpeg",
  durationMs: 1000,
}

const keys: Record<ProviderId, string> = {
  openrouter: "sk-or-v1-k",
  groq: "gsk_k",
  cerebras: "",
}

const base = { audio, keys, signal: new AbortController().signal }

describe("runTranscription", () => {
  it("runs every model in parallel and reports each as it settles", async () => {
    groqTranscribe.mockReset().mockResolvedValue({ text: "from groq", usage: null })
    openrouterTranscribe.mockReset().mockResolvedValue({
      text: "from or",
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    })
    const seen: string[] = []

    const results = await runTranscription({
      ...base,
      models: [mk("groq", "whisper-large-v3"), mk("openrouter", "google/gem")],
      onResult: (r) => seen.push(r.modelKey),
    })

    expect(results.map((r) => r.status)).toEqual(["done", "done"])
    expect(results.map((r) => r.modelKey)).toEqual([
      "groq:whisper-large-v3",
      "openrouter:google/gem",
    ])
    expect(seen.sort()).toEqual(["groq:whisper-large-v3", "openrouter:google/gem"])
    // Cost comes from usage × catalog pricing: 1000*0.001 + 500*0.002.
    expect(results[1].cost).toBeCloseTo(2)
    expect(results[0].cost).toBe(0)
  })

  it("isolates a failing model from the others", async () => {
    groqTranscribe.mockReset().mockRejectedValue(new Error("Groq rate limit hit"))
    openrouterTranscribe.mockReset().mockResolvedValue({ text: "ok", usage: null })

    const results = await runTranscription({
      ...base,
      models: [mk("groq", "whisper-large-v3"), mk("openrouter", "google/gem")],
    })

    expect(results[0]).toMatchObject({
      status: "error",
      error: "Groq rate limit hit",
    })
    expect(results[1]).toMatchObject({ status: "done", text: "ok" })
  })

  it("does not wait for a slow model before reporting a fast one", async () => {
    let releaseSlow: () => void = () => {}
    groqTranscribe.mockReset().mockImplementation(
      () =>
        new Promise((resolve) => {
          releaseSlow = () => resolve({ text: "slow", usage: null })
        }),
    )
    openrouterTranscribe.mockReset().mockResolvedValue({ text: "fast", usage: null })
    const order: string[] = []

    const run = runTranscription({
      ...base,
      models: [mk("groq", "whisper-large-v3"), mk("openrouter", "google/gem")],
      onResult: (r) => order.push(r.modelKey),
    })
    await vi.waitFor(() => expect(order).toEqual(["openrouter:google/gem"]))
    releaseSlow()
    await run
    expect(order).toEqual(["openrouter:google/gem", "groq:whisper-large-v3"])
  })

  it("fails a model without a key instead of sending a request", async () => {
    groqTranscribe.mockReset()
    const results = await runTranscription({
      ...base,
      keys: { ...keys, groq: "  " },
      models: [mk("groq", "whisper-large-v3")],
    })
    expect(groqTranscribe).not.toHaveBeenCalled()
    expect(results[0].status).toBe("error")
    expect(results[0].error).toMatch(/Groq key/)
  })

  it("rejects providers that have no transcription support", async () => {
    const results = await runTranscription({
      ...base,
      models: [mk("cerebras", "llama3.1-8b")],
    })
    expect(results[0].status).toBe("error")
    expect(results[0].error).toMatch(/no transcription models/i)
  })

  it("marks requests as Cancelled when the run is aborted", async () => {
    const controller = new AbortController()
    groqTranscribe.mockReset().mockImplementation(async () => {
      controller.abort()
      throw new DOMException("aborted", "AbortError")
    })
    const results = await runTranscription({
      ...base,
      signal: controller.signal,
      models: [mk("groq", "whisper-large-v3")],
    })
    expect(results[0]).toMatchObject({ status: "error", error: "Cancelled" })
  })

  it("records latency and a run timestamp on results", async () => {
    groqTranscribe.mockReset().mockResolvedValue({ text: "t", usage: null })
    const [r] = (await runTranscription({
      ...base,
      models: [mk("groq", "whisper-large-v3")],
    })) as TranscriptResult[]
    expect(r.latencyMs).toBeGreaterThanOrEqual(0)
    expect(r.runAt).toBeGreaterThan(0)
  })
})
