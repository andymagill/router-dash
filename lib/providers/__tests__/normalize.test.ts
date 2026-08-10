import { describe, it, expect } from "vitest"
import {
  normalizeOpenRouterModel,
  type ORModel,
} from "@/lib/providers/openrouter"
import { normalizeGroqModel, type GroqModel } from "@/lib/providers/groq"
import {
  isChatCompatibleId,
  vendorSlugFromOwner,
  vendorSlugFromId,
} from "@/lib/providers"

describe("OpenRouter normalization", () => {
  it("maps pricing, context, and free detection", () => {
    const raw: ORModel = {
      id: "openai/gpt-4o",
      name: "GPT-4o",
      context_length: 128_000,
      pricing: { prompt: "0.000005", completion: "0.000015" },
      supported_parameters: ["temperature", "top_p"],
    }
    const m = normalizeOpenRouterModel(raw)
    expect(m.key).toBe("openrouter:openai/gpt-4o")
    expect(m.provider).toBe("openrouter")
    expect(m.vendor).toBe("openai")
    expect(m.contextKnown).toBe(true)
    expect(m.contextLength).toBe(128_000)
    expect(m.pricingKnown).toBe(true)
    expect(m.isFree).toBe(false)
  })

  it("detects a free model from $0/$0 pricing", () => {
    const m = normalizeOpenRouterModel({
      id: "meta-llama/llama-3.1:free",
      name: "Llama 3.1 (free)",
      pricing: { prompt: "0", completion: "0" },
    })
    expect(m.isFree).toBe(true)
    expect(m.vendor).toBe("meta-llama")
  })

  it("marks pricing unknown when absent", () => {
    const m = normalizeOpenRouterModel({ id: "x/y", name: "y" })
    expect(m.pricingKnown).toBe(false)
    expect(m.isFree).toBe(false)
  })
})

describe("Groq normalization", () => {
  it("normalizes an active model without fabricating pricing", () => {
    const raw: GroqModel = {
      id: "llama-3.3-70b-versatile",
      owned_by: "Meta",
      active: true,
      context_window: 131_072,
    }
    const m = normalizeGroqModel(raw)
    expect(m.key).toBe("groq:llama-3.3-70b-versatile")
    expect(m.provider).toBe("groq")
    expect(m.vendor).toBe("meta")
    expect(m.contextKnown).toBe(true)
    expect(m.contextLength).toBe(131_072)
    // Groq exposes no pricing/free/modality metadata — we must not invent it.
    expect(m.pricingKnown).toBe(false)
    expect(m.isFree).toBe(false)
    expect(m.promptPrice).toBeUndefined()
    expect(m.inputModalities).toBeUndefined()
  })

  it("reports unknown context when the window is missing", () => {
    const m = normalizeGroqModel({ id: "some-model" })
    expect(m.contextKnown).toBe(false)
    expect(m.contextLength).toBeUndefined()
  })
})

describe("compatibility + vendor slugs", () => {
  it("excludes clearly non-chat model families", () => {
    expect(isChatCompatibleId("whisper-large-v3")).toBe(false)
    expect(isChatCompatibleId("playai-tts")).toBe(false)
    expect(isChatCompatibleId("meta-llama/llama-guard-4-12b")).toBe(false)
    expect(isChatCompatibleId("text-embedding-3-small")).toBe(false)
    expect(isChatCompatibleId("openai/gpt-4o")).toBe(true)
    expect(isChatCompatibleId("llama-3.3-70b-versatile")).toBe(true)
  })

  it("maps owner strings to monogram slugs", () => {
    expect(vendorSlugFromOwner("Meta")).toBe("meta")
    expect(vendorSlugFromOwner("Alibaba Cloud")).toBe("qwen")
    expect(vendorSlugFromOwner("Mistral AI")).toBe("mistralai")
    expect(vendorSlugFromOwner(undefined)).toBe("unknown")
  })

  it("extracts vendor slug from an OpenRouter id", () => {
    expect(vendorSlugFromId("anthropic/claude-3.5-sonnet")).toBe("anthropic")
  })
})
