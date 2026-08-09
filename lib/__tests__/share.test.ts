import { describe, it, expect } from "vitest"
import {
  buildSharePayload,
  encodeSharePayload,
  decodeShareToken,
  buildShareUrl,
  validateSharePayload,
  sharedResultToRunState,
  SHARE_PARAM,
  SHARE_URL_BUDGET,
} from "@/lib/share"
import type { RunParams } from "@/lib/openrouter"
import type { RunState } from "@/lib/types"

const params: RunParams = {
  systemPrompt: "You are helpful.",
  temperature: 0.7,
  topP: 1,
  maxTokens: 1024,
}

function makeRun(overrides: Partial<RunState> = {}): RunState {
  return {
    modelId: "openai/gpt-4o-mini",
    status: "done",
    content: "Hello world",
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
    cost: 0.00012,
    latencyMs: 1200,
    ...overrides,
  }
}

describe("share encode/decode round-trip", () => {
  it("preserves prompt, params, model ids, and results", () => {
    const runs = [makeRun(), makeRun({ modelId: "anthropic/claude-3.5-sonnet" })]
    const payload = buildSharePayload("Explain mutexes", params, [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
    ], runs)
    const token = encodeSharePayload(payload)
    const decoded = decodeShareToken(token)

    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.payload.prompt).toBe("Explain mutexes")
    expect(decoded.payload.params).toEqual(params)
    expect(decoded.payload.modelIds).toEqual([
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
    ])
    expect(decoded.payload.results).toHaveLength(2)
    expect(decoded.payload.results[0].content).toBe("Hello world")
  })

  it("rehydrates a shared result into a RunState with usage", () => {
    const rs = sharedResultToRunState({
      modelId: "m",
      status: "done",
      content: "x",
      promptTokens: 1,
      completionTokens: 2,
      totalTokens: 3,
      cost: 0.1,
      latencyMs: 5,
    })
    expect(rs.usage).toEqual({
      prompt_tokens: 1,
      completion_tokens: 2,
      total_tokens: 3,
    })
  })

  it("produces null usage when there are zero tokens", () => {
    const rs = sharedResultToRunState({
      modelId: "m",
      status: "error",
      content: "",
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      latencyMs: 0,
    })
    expect(rs.usage).toBeNull()
  })
})

describe("share URL never leaks an API key", () => {
  it("does not include an injected key-like field in the token", () => {
    const runs = [makeRun()]
    // Simulate a caller accidentally passing an object with a key attached.
    const tainted = { ...makeRun(), apiKey: "sk-or-SECRET-KEY-123" } as RunState
    const payload = buildSharePayload("p", params, ["m"], [tainted])
    const token = encodeSharePayload(payload)
    // The serialized payload only carries whitelisted fields.
    const decoded = decodeShareToken(token)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    const serialized = JSON.stringify(decoded.payload)
    expect(serialized).not.toContain("sk-or-SECRET-KEY-123")
    expect(serialized).not.toContain("apiKey")
    // sanity: the legit run is still present
    void runs
  })
})

describe("buildShareUrl budget handling", () => {
  it("keeps response bodies for small payloads", () => {
    const { url, truncated } = buildShareUrl(
      "https://x.dev/",
      "short",
      params,
      ["m"],
      [makeRun()],
    )
    expect(truncated).toBe(false)
    expect(url).toContain(`${SHARE_PARAM}=`)
  })

  it("drops response bodies when the payload exceeds the budget", () => {
    // Use incompressible (random) content so lz-string can't shrink it below
    // the budget — a repeated or periodic string would compress away and stay
    // small, which is the correct (non-truncating) behavior.
    let blob = ""
    for (let i = 0; i < SHARE_URL_BUDGET * 2; i++) {
      blob += String.fromCharCode(33 + Math.floor(Math.random() * 94))
    }
    const huge = makeRun({ content: blob })
    const { url, truncated } = buildShareUrl(
      "https://x.dev/",
      "big",
      params,
      ["m"],
      [huge],
    )
    expect(truncated).toBe(true)
    const token = new URL(url).searchParams.get(SHARE_PARAM)!
    const decoded = decodeShareToken(token)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.payload.truncated).toBe(true)
    expect(decoded.payload.results[0].content).toBe("")
  })

  it("uses & separator when base URL already has a query string", () => {
    const { url } = buildShareUrl(
      "https://x.dev/?foo=bar",
      "p",
      params,
      ["m"],
      [makeRun()],
    )
    expect(url).toContain(`&${SHARE_PARAM}=`)
  })
})

describe("decode validation rejects bad input", () => {
  it("rejects an empty token", () => {
    expect(decodeShareToken("")).toEqual({
      ok: false,
      reason: expect.any(String),
    })
  })

  it("rejects a corrupt token", () => {
    const r = decodeShareToken("!!!not-a-real-token!!!")
    expect(r.ok).toBe(false)
  })

  it("rejects a payload missing required fields", () => {
    expect(validateSharePayload({ v: 1 }).ok).toBe(false)
    expect(
      validateSharePayload({ v: 1, prompt: "x", params: {}, modelIds: [], results: [] })
        .ok,
    ).toBe(false)
  })

  it("rejects results with an invalid status", () => {
    const bad = {
      v: 1,
      prompt: "x",
      params,
      modelIds: ["m"],
      results: [
        {
          modelId: "m",
          status: "exploded",
          content: "",
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          cost: 0,
          latencyMs: 0,
        },
      ],
    }
    expect(validateSharePayload(bad).ok).toBe(false)
  })
})
