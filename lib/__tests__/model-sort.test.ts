import { describe, it, expect } from "vitest"

import { filterModels, sortModels, type ModelFilters } from "@/lib/model-sort"
import type { UnifiedModel, ProviderId } from "@/lib/providers"

function model(over: Partial<UnifiedModel> & { modelId: string }): UnifiedModel {
  const provider: ProviderId = over.provider ?? "openrouter"
  return {
    key: `${provider}:${over.modelId}`,
    name: over.modelId,
    vendor: "openai",
    contextKnown: true,
    contextLength: 8_000,
    pricingKnown: true,
    promptPrice: "0.000001",
    completionPrice: "0.000002",
    isFree: false,
    ...over,
    provider,
  }
}

const names = (models: UnifiedModel[]) => models.map((m) => m.name)

describe("sortModels", () => {
  it("sorts by name in both directions", () => {
    const models = [model({ modelId: "c" }), model({ modelId: "a" }), model({ modelId: "b" })]
    expect(names(sortModels(models, "name", "asc"))).toEqual(["a", "b", "c"])
    expect(names(sortModels(models, "name", "desc"))).toEqual(["c", "b", "a"])
  })

  it("does not mutate the input array", () => {
    const models = [model({ modelId: "c" }), model({ modelId: "a" })]
    sortModels(models, "name", "asc")
    expect(names(models)).toEqual(["c", "a"])
  })

  it("sorts by context length", () => {
    const models = [
      model({ modelId: "small", contextLength: 4_000 }),
      model({ modelId: "huge", contextLength: 200_000 }),
      model({ modelId: "mid", contextLength: 32_000 }),
    ]
    expect(names(sortModels(models, "context", "asc"))).toEqual([
      "small",
      "mid",
      "huge",
    ])
    expect(names(sortModels(models, "context", "desc"))).toEqual([
      "huge",
      "mid",
      "small",
    ])
  })

  it("sorts by prompt and completion price independently", () => {
    const models = [
      model({ modelId: "x", promptPrice: "0.00003", completionPrice: "0.00001" }),
      model({ modelId: "y", promptPrice: "0.00001", completionPrice: "0.00003" }),
    ]
    expect(names(sortModels(models, "promptPrice", "asc"))).toEqual(["y", "x"])
    expect(names(sortModels(models, "completionPrice", "asc"))).toEqual(["x", "y"])
  })

  it("breaks ties by name for every column", () => {
    const models = [
      model({ modelId: "zeta", contextLength: 8_000 }),
      model({ modelId: "alpha", contextLength: 8_000 }),
    ]
    expect(names(sortModels(models, "context", "asc"))).toEqual(["alpha", "zeta"])
    // The tiebreaker stays ascending even when the primary sort is descending,
    // so equal-value rows do not shuffle when the arrow flips.
    expect(names(sortModels(models, "context", "desc"))).toEqual(["alpha", "zeta"])
  })

  it("sorts unknown context last in both directions", () => {
    const models = [
      model({ modelId: "unknown", contextKnown: false, contextLength: undefined }),
      model({ modelId: "known", contextLength: 8_000 }),
    ]
    expect(names(sortModels(models, "context", "asc"))).toEqual([
      "known",
      "unknown",
    ])
    expect(names(sortModels(models, "context", "desc"))).toEqual([
      "known",
      "unknown",
    ])
  })

  it("sorts unknown pricing last in both directions", () => {
    const models = [
      model({
        modelId: "unpriced",
        pricingKnown: false,
        promptPrice: undefined,
        completionPrice: undefined,
      }),
      model({ modelId: "priced", promptPrice: "0.00002" }),
    ]
    expect(names(sortModels(models, "promptPrice", "asc"))).toEqual([
      "priced",
      "unpriced",
    ])
    expect(names(sortModels(models, "promptPrice", "desc"))).toEqual([
      "priced",
      "unpriced",
    ])
  })

  it("sorts runtime-priced models (OpenRouter's \"-1\") last, not cheapest", () => {
    const models = [
      // OpenRouter reports -1 for its auto-routers: a sentinel, not a price.
      model({ modelId: "auto", promptPrice: "-1", completionPrice: "-1" }),
      model({ modelId: "free", promptPrice: "0", completionPrice: "0", isFree: true }),
      model({ modelId: "paid", promptPrice: "0.00002" }),
    ]
    expect(names(sortModels(models, "promptPrice", "asc"))).toEqual([
      "free",
      "paid",
      "auto",
    ])
    expect(names(sortModels(models, "promptPrice", "desc"))).toEqual([
      "paid",
      "free",
      "auto",
    ])
  })

  it("keeps free models cheapest when sorting by price ascending", () => {
    const models = [
      model({ modelId: "paid", promptPrice: "0.00002" }),
      model({ modelId: "free", promptPrice: "0", completionPrice: "0", isFree: true }),
    ]
    expect(names(sortModels(models, "promptPrice", "asc"))[0]).toBe("free")
  })

  it("sorts providers by PROVIDER_ORDER, not alphabetically", () => {
    const models = [
      model({ modelId: "g", provider: "groq" }),
      model({ modelId: "o", provider: "openrouter" }),
    ]
    // Alphabetically "groq" precedes "openrouter"; PROVIDER_ORDER is the reverse.
    expect(
      sortModels(models, "provider", "asc").map((m) => m.provider),
    ).toEqual(["openrouter", "groq"])
    expect(
      sortModels(models, "provider", "desc").map((m) => m.provider),
    ).toEqual(["groq", "openrouter"])
  })
})

describe("filterModels", () => {
  const catalog = [
    model({ modelId: "openai/gpt-4o", name: "GPT-4o", vendor: "openai", owner: "openai" }),
    model({
      modelId: "meta-llama/llama-3.3-70b",
      name: "Llama 3.3 70B",
      vendor: "meta",
      contextLength: 128_000,
      promptPrice: "0",
      completionPrice: "0",
      isFree: true,
    }),
    model({
      modelId: "llama-3.1-8b-instant",
      name: "Llama 3.1 8B",
      provider: "groq",
      vendor: "meta",
      contextLength: 4_000,
    }),
  ]
  const noFilters: ModelFilters = { search: "", providers: [], meta: [] }

  it("returns everything when no filters are set", () => {
    expect(filterModels(catalog, { ...noFilters })).toHaveLength(3)
  })

  it("treats an empty providers array as all providers", () => {
    expect(filterModels(catalog, { ...noFilters, providers: [] })).toHaveLength(3)
    expect(
      filterModels(catalog, { ...noFilters, providers: ["groq"] }).map((m) => m.name),
    ).toEqual(["Llama 3.1 8B"])
  })

  it("filters to free models only", () => {
    expect(
      filterModels(catalog, { ...noFilters, meta: ["free"] }).map((m) => m.name),
    ).toEqual(["Llama 3.3 70B"])
  })

  it("filters to long-context models only", () => {
    expect(
      filterModels(catalog, { ...noFilters, meta: ["long"] }).map((m) => m.name),
    ).toEqual(["Llama 3.3 70B"])
  })

  it("combines meta filters conjunctively", () => {
    const free8k = model({
      modelId: "tiny-free",
      contextLength: 4_000,
      promptPrice: "0",
      isFree: true,
    })
    expect(
      filterModels([...catalog, free8k], { ...noFilters, meta: ["free", "long"] }).map(
        (m) => m.name,
      ),
    ).toEqual(["Llama 3.3 70B"])
  })

  it("searches modelId, name, owner, vendor and the provider label", () => {
    const search = (q: string) =>
      filterModels(catalog, { ...noFilters, search: q }).map((m) => m.name)

    expect(search("gpt-4o")).toEqual(["GPT-4o"]) // modelId
    expect(search("llama 3.3")).toEqual(["Llama 3.3 70B"]) // name
    expect(search("meta")).toEqual(["Llama 3.3 70B", "Llama 3.1 8B"]) // vendor
    expect(search("groq")).toEqual(["Llama 3.1 8B"]) // adapter label
  })

  it("searches case-insensitively and ignores surrounding whitespace", () => {
    expect(
      filterModels(catalog, { ...noFilters, search: "  GPT-4O  " }).map((m) => m.name),
    ).toEqual(["GPT-4o"])
  })

  it("applies filters and search together", () => {
    expect(
      filterModels(catalog, {
        search: "llama",
        providers: ["openrouter"],
        meta: ["long"],
      }).map((m) => m.name),
    ).toEqual(["Llama 3.3 70B"])
  })
})
