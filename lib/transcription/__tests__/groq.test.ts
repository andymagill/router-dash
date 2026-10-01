import { afterEach, describe, expect, it, vi } from "vitest"
import type { UnifiedModel } from "@/lib/providers/types"
import { ProviderError } from "@/lib/providers/errors"
import {
  groqSttAdapter,
  isGroqSttModelId,
  parseGroqTranscription,
} from "../groq"

const model: UnifiedModel = {
  key: "groq:whisper-large-v3-turbo",
  provider: "groq",
  modelId: "whisper-large-v3-turbo",
  name: "whisper-large-v3-turbo",
  vendor: "openai",
  contextKnown: false,
  pricingKnown: false,
  isFree: false,
}

const audio = {
  blob: new Blob(["audio-bytes"], { type: "audio/mpeg" }),
  fileName: "clip.mp3",
  mimeType: "audio/mpeg",
  durationMs: 4000,
}

function mockFetch(response: Response | Error) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    if (response instanceof Error) throw response
    return response
  })
  vi.stubGlobal("fetch", fn)
  return fn
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status })

afterEach(() => vi.unstubAllGlobals())

describe("isGroqSttModelId", () => {
  it("matches whisper models and skips guard models", () => {
    expect(isGroqSttModelId("whisper-large-v3")).toBe(true)
    expect(isGroqSttModelId("distil-whisper-large-v3-en")).toBe(true)
    expect(isGroqSttModelId("llama-3.3-70b-versatile")).toBe(false)
    expect(isGroqSttModelId("whisper-guard")).toBe(false)
  })
})

describe("parseGroqTranscription", () => {
  it("trims text and converts segment seconds to ms", () => {
    const out = parseGroqTranscription({
      text: "  hello world ",
      segments: [
        { text: " hello", start: 0, end: 1.25 },
        { text: " world", start: 1.25, end: 2.5 },
      ],
    })
    expect(out.text).toBe("hello world")
    expect(out.segments).toEqual([
      { text: "hello", startMs: 0, endMs: 1250 },
      { text: "world", startMs: 1250, endMs: 2500 },
    ])
    expect(out.usage).toBeNull()
  })

  it("omits segments when the response has none", () => {
    expect(parseGroqTranscription({ text: "x" }).segments).toBeUndefined()
  })

  it("tolerates a malformed body", () => {
    expect(parseGroqTranscription(null).text).toBe("")
  })
})

describe("groqSttAdapter.transcribe", () => {
  it("posts multipart to the transcriptions endpoint with the user's key", async () => {
    const fetchMock = mockFetch(json({ text: "hi there", segments: [] }))
    const out = await groqSttAdapter.transcribe(
      "gsk_secret",
      model,
      audio,
      { language: "en" },
    )

    expect(out.text).toBe("hi there")
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://api.groq.com/openai/v1/audio/transcriptions")
    expect(init.method).toBe("POST")
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer gsk_secret")
    const form = init.body as FormData
    expect(form.get("model")).toBe("whisper-large-v3-turbo")
    expect(form.get("response_format")).toBe("verbose_json")
    expect(form.get("language")).toBe("en")
    expect((form.get("file") as File).name).toBe("clip.mp3")
  })

  it("omits language when auto-detecting", async () => {
    const fetchMock = mockFetch(json({ text: "x" }))
    await groqSttAdapter.transcribe("gsk_k", model, audio, {})
    const init = fetchMock.mock.calls[0][1] as unknown as RequestInit
    expect((init.body as FormData).has("language")).toBe(false)
  })

  it("turns an auth failure into a sanitized ProviderError", async () => {
    mockFetch(json({ error: { message: "bad key gsk_leakedkey123" } }, 401))
    const err = await groqSttAdapter
      .transcribe("gsk_leakedkey123", model, audio, {})
      .catch((e) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err.category).toBe("auth")
    expect(err.message).not.toContain("gsk_leakedkey123")
    expect(err.detail).not.toContain("gsk_leakedkey123")
  })

  it("maps a network failure to a ProviderError", async () => {
    mockFetch(new TypeError("Failed to fetch"))
    const err = await groqSttAdapter
      .transcribe("gsk_k", model, audio, {})
      .catch((e) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect(err.category).toBe("network")
  })

  it("lets an AbortError propagate unchanged", async () => {
    mockFetch(new DOMException("aborted", "AbortError"))
    await expect(
      groqSttAdapter.transcribe("gsk_k", model, audio, {}),
    ).rejects.toMatchObject({ name: "AbortError" })
  })
})

describe("groqSttAdapter.listModels", () => {
  it("returns only active whisper models", async () => {
    mockFetch(
      json({
        data: [
          { id: "whisper-large-v3", owned_by: "OpenAI" },
          { id: "whisper-large-v3-turbo", owned_by: "OpenAI", active: false },
          { id: "llama-3.3-70b-versatile", owned_by: "Meta" },
        ],
      }),
    )
    const models = await groqSttAdapter.listModels("gsk_k")
    expect(models.map((m) => m.key)).toEqual(["groq:whisper-large-v3"])
  })
})
