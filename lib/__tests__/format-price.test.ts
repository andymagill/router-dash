import { describe, it, expect } from "vitest"

import { hasFixedPrice, pricePerMillion } from "@/lib/format"

describe("hasFixedPrice", () => {
  it("accepts real prices including zero", () => {
    expect(hasFixedPrice("0")).toBe(true)
    expect(hasFixedPrice("0.00002")).toBe(true)
  })

  it("rejects missing, non-numeric and sentinel values", () => {
    expect(hasFixedPrice(undefined)).toBe(false)
    expect(hasFixedPrice("")).toBe(false)
    expect(hasFixedPrice("n/a")).toBe(false)
    // OpenRouter uses -1 for models priced at runtime.
    expect(hasFixedPrice("-1")).toBe(false)
  })
})

describe("pricePerMillion", () => {
  it("formats a per-token price per million tokens", () => {
    expect(pricePerMillion("0.0000025")).toBe("$2.50")
  })

  it("labels a zero price as free", () => {
    expect(pricePerMillion("0")).toBe("Free")
  })

  it("never formats the -1 sentinel as a negative dollar amount", () => {
    expect(pricePerMillion("-1")).toBe("—")
  })

  it("falls back for unknown input", () => {
    expect(pricePerMillion(undefined)).toBe("—")
    expect(pricePerMillion("abc")).toBe("—")
  })
})
