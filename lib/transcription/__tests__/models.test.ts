import { describe, expect, it } from "vitest"
import type { UnifiedModel } from "@/lib/providers/types"
import { resolveSttModel } from "../models"

const catalogModel: UnifiedModel = {
  key: "groq:whisper-large-v3",
  provider: "groq",
  modelId: "whisper-large-v3",
  name: "whisper-large-v3",
  vendor: "openai",
  contextKnown: false,
  pricingKnown: false,
  isFree: false,
}

describe("resolveSttModel", () => {
  it("returns the catalog model when present", () => {
    const map = new Map([[catalogModel.key, catalogModel]])
    expect(resolveSttModel(catalogModel.key, map)).toBe(catalogModel)
  })

  it("synthesizes a Groq stub for a model missing from the catalog", () => {
    const stub = resolveSttModel("groq:whisper-large-v3-turbo", new Map())
    expect(stub).toMatchObject({
      key: "groq:whisper-large-v3-turbo",
      provider: "groq",
      modelId: "whisper-large-v3-turbo",
      vendor: "unknown",
    })
  })

  it("derives the vendor from an OpenRouter vendor/model id", () => {
    const stub = resolveSttModel("openrouter:google/gemini-2.5-flash", new Map())
    expect(stub.provider).toBe("openrouter")
    expect(stub.vendor).toBe("google")
  })
})
