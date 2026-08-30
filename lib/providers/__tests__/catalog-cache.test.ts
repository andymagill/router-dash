import { describe, it, expect } from "vitest"
import {
  readCatalogCache,
  writeCatalogCache,
  clearCatalogCache,
  CATALOG_TTL_MS,
  type CacheStorage,
} from "@/lib/providers"
import type { UnifiedModel } from "@/lib/providers"

function makeStorage(): CacheStorage {
  const map = new Map<string, string>()
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

const sample: UnifiedModel[] = [
  {
    key: "groq:llama-3.3-70b-versatile",
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    name: "llama-3.3-70b-versatile",
    vendor: "meta",
    contextKnown: true,
    contextLength: 131_072,
    pricingKnown: false,
    isFree: false,
  },
]

describe("catalog TTL cache", () => {
  it("returns fresh entries within the TTL", () => {
    const storage = makeStorage()
    const now = 1_000_000
    writeCatalogCache("groq", sample, { now, storage })
    const read = readCatalogCache("groq", {
      now: now + CATALOG_TTL_MS - 1,
      storage,
    })
    expect(read).not.toBeNull()
    expect(read?.[0].key).toBe("groq:llama-3.3-70b-versatile")
  })

  it("expires entries past the TTL", () => {
    const storage = makeStorage()
    const now = 1_000_000
    writeCatalogCache("groq", sample, { now, storage })
    const read = readCatalogCache("groq", {
      now: now + CATALOG_TTL_MS + 1,
      storage,
    })
    expect(read).toBeNull()
  })

  it("uses a one-hour TTL", () => {
    expect(CATALOG_TTL_MS).toBe(60 * 60 * 1000)
  })

  it("isolates providers and clears on demand", () => {
    const storage = makeStorage()
    const now = 5_000
    writeCatalogCache("groq", sample, { now, storage })
    expect(readCatalogCache("openrouter", { now, storage })).toBeNull()
    expect(readCatalogCache("cerebras", { now, storage })).toBeNull()
    clearCatalogCache("groq", { storage })
    expect(readCatalogCache("groq", { now, storage })).toBeNull()
  })

  it("namespaces the Cerebras cache separately from Groq and OpenRouter", () => {
    const storage = makeStorage()
    const now = 5_000
    const cerebrasSample: UnifiedModel[] = [
      { ...sample[0], key: "cerebras:llama-3.3-70b", provider: "cerebras", modelId: "llama-3.3-70b" },
    ]
    writeCatalogCache("cerebras", cerebrasSample, { now, storage })
    writeCatalogCache("groq", sample, { now, storage })
    expect(readCatalogCache("cerebras", { now, storage })?.[0].key).toBe(
      "cerebras:llama-3.3-70b",
    )
    expect(readCatalogCache("groq", { now, storage })?.[0].key).toBe(
      "groq:llama-3.3-70b-versatile",
    )
  })

  it("ignores corrupt cache payloads", () => {
    const storage = makeStorage()
    storage.setItem("routerdash:catalog:groq", "not json{")
    expect(readCatalogCache("groq", { storage })).toBeNull()
  })
})
