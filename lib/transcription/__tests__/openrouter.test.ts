import { afterEach, describe, expect, it, vi } from "vitest"
import type { UnifiedModel } from "@/lib/providers/types"

vi.mock("@/lib/audio/wav", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/audio/wav")>()
  // No AudioContext in node; stand in for the browser decode + resample.
  return { ...actual, blobToWav16k: vi.fn(async () => new Uint8Array([1, 2, 3])) }
})

import { blobToWav16k } from "@/lib/audio/wav"
import {
  buildTranscriptionMessages,
  nativeAudioFormat,
  openRouterSttAdapter,
  prepareAudioPart,
} from "../openrouter"
import { supportsAudioInput } from "../types"

const model: UnifiedModel = {
  key: "openrouter:google/gemini-2.5-flash",
  provider: "openrouter",
  modelId: "google/gemini-2.5-flash",
  name: "Gemini 2.5 Flash",
  vendor: "google",
  contextKnown: false,
  pricingKnown: true,
  promptPrice: "0.000001",
  completionPrice: "0.000002",
  isFree: false,
  inputModalities: ["text", "audio"],
}

function audioOf(name: string, mime: string, bytes: number[] = [10, 20, 30]) {
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: mime }),
    fileName: name,
    mimeType: mime,
    durationMs: 3000,
  }
}

function mockChatResponse(content: string) {
  const fn = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { content } }],
          usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
        }),
        { status: 200 },
      ),
  )
  vi.stubGlobal("fetch", fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.mocked(blobToWav16k).mockClear()
})

describe("nativeAudioFormat", () => {
  it("recognizes wav and mp3 by extension or MIME type", () => {
    expect(nativeAudioFormat({ fileName: "a.WAV", mimeType: "" })).toBe("wav")
    expect(nativeAudioFormat({ fileName: "a", mimeType: "audio/mpeg" })).toBe("mp3")
    expect(nativeAudioFormat({ fileName: "a", mimeType: "audio/x-wav" })).toBe("wav")
  })

  it("returns null for containers that need conversion", () => {
    expect(nativeAudioFormat({ fileName: "a.m4a", mimeType: "audio/mp4" })).toBeNull()
    expect(nativeAudioFormat({ fileName: "a.webm", mimeType: "audio/webm" })).toBeNull()
  })
})

describe("supportsAudioInput", () => {
  it("is true only with positive evidence of audio input", () => {
    expect(supportsAudioInput(model)).toBe(true)
    expect(supportsAudioInput({ ...model, inputModalities: ["text"] })).toBe(false)
    expect(supportsAudioInput({ ...model, inputModalities: undefined })).toBe(false)
  })
})

describe("buildTranscriptionMessages", () => {
  it("sends a system instruction and a text + input_audio user turn", () => {
    const msgs = buildTranscriptionMessages({ data: "QUJD", format: "wav" })
    expect(msgs[0].role).toBe("system")
    expect(msgs[1].content).toEqual([
      { type: "text", text: "Transcribe this audio." },
      { type: "input_audio", input_audio: { data: "QUJD", format: "wav" } },
    ])
  })

  it("mentions the language when one is chosen", () => {
    const msgs = buildTranscriptionMessages({ data: "x", format: "mp3" }, "es")
    const parts = msgs[1].content as { type: string; text?: string }[]
    expect(parts[0].text).toContain('"es"')
  })
})

describe("prepareAudioPart", () => {
  it("sends wav and mp3 as-is without decoding", async () => {
    const part = await prepareAudioPart(audioOf("a.wav", "audio/wav", [1, 2, 3]))
    expect(part).toEqual({ data: "AQID", format: "wav" })
    expect(blobToWav16k).not.toHaveBeenCalled()
  })

  it("converts other containers to wav", async () => {
    const part = await prepareAudioPart(audioOf("a.m4a", "audio/mp4"))
    expect(part.format).toBe("wav")
    expect(blobToWav16k).toHaveBeenCalledTimes(1)
  })

  it("shares one conversion between concurrent callers", async () => {
    const input = audioOf("memo.m4a", "audio/mp4")
    const [a, b] = await Promise.all([prepareAudioPart(input), prepareAudioPart(input)])
    expect(a).toBe(b)
    expect(blobToWav16k).toHaveBeenCalledTimes(1)
  })
})

describe("openRouterSttAdapter.transcribe", () => {
  it("posts a chat completion with the audio part and returns the transcript", async () => {
    const fetchMock = mockChatResponse("  hello world \n")
    const out = await openRouterSttAdapter.transcribe(
      "sk-or-v1-secretkey123",
      model,
      audioOf("a.mp3", "audio/mpeg", [1, 2, 3]),
      {},
    )

    expect(out.text).toBe("hello world")
    expect(out.usage).toMatchObject({ prompt_tokens: 100 })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe("google/gemini-2.5-flash")
    expect(body.temperature).toBe(0)
    expect(body.messages[1].content[1]).toEqual({
      type: "input_audio",
      input_audio: { data: "AQID", format: "mp3" },
    })
  })
})
