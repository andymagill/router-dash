import { describe, it, expect } from "vitest"

import {
  createSavedPrompt,
  filterLibrary,
  parseSavedPrompts,
  defaultPromptName,
  MAX_SAVED_PROMPTS,
  type SavedPrompt,
} from "@/lib/prompt-library"

function saved(over: Partial<SavedPrompt> & { id: string }): SavedPrompt {
  return {
    label: "Untitled",
    description: "",
    prompt: "",
    system: "",
    params: { temperature: 1, topP: 1, maxTokens: 1024 },
    createdAt: 0,
    ...over,
  }
}

describe("createSavedPrompt", () => {
  it("trims label/description and stamps id + createdAt", () => {
    const p = createSavedPrompt({
      label: "  My prompt  ",
      description: "  a note  ",
      prompt: "hello",
      system: "be nice",
      params: { temperature: 0.5, topP: 1, maxTokens: 512 },
    })
    expect(p.label).toBe("My prompt")
    expect(p.description).toBe("a note")
    expect(p.id).toMatch(/^user-/)
    expect(p.createdAt).toBeGreaterThan(0)
    expect(p.params).toEqual({ temperature: 0.5, topP: 1, maxTokens: 512 })
  })

  it("generates distinct ids for successive calls", () => {
    const a = createSavedPrompt({
      label: "a",
      description: "",
      prompt: "",
      system: "",
      params: { temperature: 1, topP: 1, maxTokens: 1024 },
    })
    const b = createSavedPrompt({
      label: "b",
      description: "",
      prompt: "",
      system: "",
      params: { temperature: 1, topP: 1, maxTokens: 1024 },
    })
    expect(a.id).not.toBe(b.id)
  })
})

describe("filterLibrary", () => {
  const items = [
    saved({ id: "1", label: "Code Refactor", description: "Improve a function", prompt: "refactor this" }),
    saved({ id: "2", label: "JSON Extraction", description: "Structured data", prompt: "extract fields from text", system: "respond only in json" }),
  ]

  it("returns all items unchanged for an empty query", () => {
    expect(filterLibrary(items, "")).toBe(items)
    expect(filterLibrary(items, "   ")).toBe(items)
  })

  it("matches text that only appears in the prompt body, not just the title", () => {
    const result = filterLibrary(items, "extract fields")
    expect(result.map((i) => i.id)).toEqual(["2"])
  })

  it("matches text that only appears in the system prompt", () => {
    const result = filterLibrary(items, "respond only")
    expect(result.map((i) => i.id)).toEqual(["2"])
  })

  it("is case-insensitive", () => {
    const result = filterLibrary(items, "REFACTOR")
    expect(result.map((i) => i.id)).toEqual(["1"])
  })

  it("returns an empty array when nothing matches", () => {
    expect(filterLibrary(items, "nonexistent")).toEqual([])
  })
})

describe("parseSavedPrompts", () => {
  it("returns an empty array for null or a non-array", () => {
    expect(parseSavedPrompts(null)).toEqual([])
    expect(parseSavedPrompts(undefined)).toEqual([])
    expect(parseSavedPrompts("not an array")).toEqual([])
    expect(parseSavedPrompts({ id: "1" })).toEqual([])
  })

  it("drops entries missing id, label, or prompt", () => {
    const result = parseSavedPrompts([
      { label: "no id", prompt: "x" },
      { id: "1", prompt: "x" },
      { id: "2", label: "no prompt" },
      { id: "3", label: "ok", prompt: "hello" },
    ])
    expect(result.map((r) => r.id)).toEqual(["3"])
  })

  it("backfills a missing description and params", () => {
    const result = parseSavedPrompts([{ id: "1", label: "L", prompt: "P" }])
    expect(result[0].description).toBe("")
    expect(result[0].system).toBe("")
    expect(result[0].params).toEqual({ temperature: 1, topP: 1, maxTokens: 1024 })
  })

  it("caps at MAX_SAVED_PROMPTS", () => {
    const raw = Array.from({ length: MAX_SAVED_PROMPTS + 20 }, (_, i) => ({
      id: `${i}`,
      label: `L${i}`,
      prompt: "p",
    }))
    expect(parseSavedPrompts(raw)).toHaveLength(MAX_SAVED_PROMPTS)
  })
})

describe("defaultPromptName", () => {
  it("takes the first non-empty line", () => {
    expect(defaultPromptName("\n\n  Explain mutexes\nmore detail below")).toBe(
      "Explain mutexes",
    )
  })

  it("collapses internal whitespace", () => {
    expect(defaultPromptName("hello    world")).toBe("hello world")
  })

  it("returns an empty string for an all-whitespace prompt", () => {
    expect(defaultPromptName("   \n  \n")).toBe("")
  })

  it("truncates long lines to 60 characters with an ellipsis", () => {
    const long = "x".repeat(100)
    const result = defaultPromptName(long)
    expect(result.length).toBe(60)
    expect(result.endsWith("…")).toBe(true)
  })
})
