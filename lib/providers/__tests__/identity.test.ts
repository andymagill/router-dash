import { describe, it, expect } from "vitest"
import {
  makeModelKey,
  parseModelKey,
  normalizeStoredKey,
  isProviderId,
  isLongContext,
  estimateCost,
  supportsParam,
  type UnifiedModel,
} from "@/lib/providers"

function model(overrides: Partial<UnifiedModel> = {}): UnifiedModel {
  return {
    key: "openrouter:openai/gpt-4o",
    provider: "openrouter",
    modelId: "openai/gpt-4o",
    name: "GPT-4o",
    vendor: "openai",
    contextKnown: true,
    contextLength: 128_000,
    pricingKnown: true,
    promptPrice: "0.000005",
    completionPrice: "0.000015",
    isFree: false,
    ...overrides,
  }
}

describe("composite model identity", () => {
  it("builds and parses composite keys", () => {
    expect(makeModelKey("groq", "llama-3.3-70b-versatile")).toBe(
      "groq:llama-3.3-70b-versatile",
    )
    expect(parseModelKey("groq:llama-3.3-70b-versatile")).toEqual({
      provider: "groq",
      modelId: "llama-3.3-70b-versatile",
    })
  })

  it("keeps the model id intact when it contains colons", () => {
    // OpenRouter ids can contain a ':' (e.g. free variant suffixes).
    expect(parseModelKey("openrouter:meta-llama/llama-3.1:free")).toEqual({
      provider: "openrouter",
      modelId: "meta-llama/llama-3.1:free",
    })
  })

  it("treats an unprefixed id as a legacy OpenRouter model", () => {
    expect(parseModelKey("openai/gpt-4o")).toEqual({
      provider: "openrouter",
      modelId: "openai/gpt-4o",
    })
    expect(normalizeStoredKey("openai/gpt-4o")).toBe("openrouter:openai/gpt-4o")
  })

  it("normalization is idempotent", () => {
    const once = normalizeStoredKey("anthropic/claude-3.5-sonnet")
    expect(normalizeStoredKey(once)).toBe(once)
  })

  it("does not collide across providers for the same base id", () => {
    // Same base model available on two providers must stay distinct.
    expect(makeModelKey("openrouter", "llama-3.3-70b")).not.toBe(
      makeModelKey("groq", "llama-3.3-70b"),
    )
  })

  it("does not collide across all three providers for the same base id", () => {
    const keys = new Set([
      makeModelKey("openrouter", "llama-3.3-70b"),
      makeModelKey("groq", "llama-3.3-70b"),
      makeModelKey("cerebras", "llama-3.3-70b"),
    ])
    expect(keys.size).toBe(3)
  })

  it("parses a cerebras-prefixed key (regression: must not fall back to openrouter)", () => {
    expect(parseModelKey("cerebras:llama-3.3-70b")).toEqual({
      provider: "cerebras",
      modelId: "llama-3.3-70b",
    })
  })

  it("guards provider ids", () => {
    expect(isProviderId("groq")).toBe(true)
    expect(isProviderId("openrouter")).toBe(true)
    expect(isProviderId("cerebras")).toBe(true)
    expect(isProviderId("azure")).toBe(false)
  })
})

describe("metadata helpers", () => {
  it("flags long-context models at the 128K threshold", () => {
    expect(isLongContext(model({ contextLength: 128_000 }))).toBe(true)
    expect(isLongContext(model({ contextLength: 32_000 }))).toBe(false)
    expect(isLongContext(model({ contextLength: undefined }))).toBe(false)
  })

  it("estimates cost only when pricing is known", () => {
    const usage = {
      prompt_tokens: 1000,
      completion_tokens: 1000,
      total_tokens: 2000,
    }
    expect(estimateCost(model(), usage)).toBeCloseTo(0.02, 6)
    // Groq-style model with unknown pricing must never fabricate a cost.
    expect(
      estimateCost(model({ pricingKnown: false }), usage),
    ).toBe(0)
    expect(estimateCost(model(), null)).toBe(0)
  })

  it("assumes param support when metadata is absent", () => {
    expect(supportsParam(model({ supportedParameters: undefined }), "top_p")).toBe(
      true,
    )
    expect(
      supportsParam(model({ supportedParameters: ["temperature"] }), "top_p"),
    ).toBe(false)
    expect(
      supportsParam(
        model({ supportedParameters: ["temperature", "top_p"] }),
        "top_p",
      ),
    ).toBe(true)
  })
})
