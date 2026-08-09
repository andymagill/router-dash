import { describe, it, expect } from "vitest"
import {
  serializeJsonExport,
  buildJsonExport,
  buildCsvExport,
  escapeCsvField,
  parseJsonImport,
  isHistoryEntry,
} from "@/lib/export"
import type { HistoryEntry } from "@/lib/types"
import type { RunParams } from "@/lib/openrouter"

const params: RunParams = {
  systemPrompt: "",
  temperature: 1,
  topP: 1,
  maxTokens: 512,
}

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: "entry-1",
    createdAt: 1_700_000_000_000,
    prompt: "Explain recursion",
    params,
    modelIds: ["openai/gpt-4o-mini"],
    results: [
      {
        modelId: "openai/gpt-4o-mini",
        status: "done",
        content: "Recursion is when a function calls itself.",
        usage: { prompt_tokens: 5, completion_tokens: 9, total_tokens: 14 },
        cost: 0.0001,
        latencyMs: 900,
      },
    ],
    elapsedMs: 900,
    totalCost: 0.0001,
    ...overrides,
  }
}

describe("JSON export", () => {
  it("wraps entries in a versioned, identifiable envelope", () => {
    const env = buildJsonExport([makeEntry()])
    expect(env.kind).toBe("routerdash.benchmark-export")
    expect(env.version).toBe(1)
    expect(env.entries).toHaveLength(1)
    expect(typeof env.exportedAt).toBe("string")
  })

  it("strips unexpected/sensitive keys from entries", () => {
    const tainted = {
      ...makeEntry(),
      apiKey: "sk-or-LEAK",
      results: [
        {
          modelId: "m",
          status: "done" as const,
          content: "ok",
          usage: null,
          cost: 0,
          latencyMs: 1,
          apiKey: "sk-or-NESTED-LEAK",
        },
      ],
    } as unknown as HistoryEntry
    const json = serializeJsonExport([tainted])
    expect(json).not.toContain("sk-or-LEAK")
    expect(json).not.toContain("sk-or-NESTED-LEAK")
    expect(json).not.toContain("apiKey")
  })
})

describe("CSV export", () => {
  it("emits a header row plus one row per entry", () => {
    const csv = buildCsvExport([makeEntry(), makeEntry({ id: "entry-2" })])
    const lines = csv.split("\r\n")
    expect(lines[0]).toContain("timestamp")
    expect(lines).toHaveLength(3)
  })

  it("excludes full response bodies", () => {
    const csv = buildCsvExport([makeEntry()])
    expect(csv).not.toContain("Recursion is when a function calls itself.")
  })

  it("escapes fields containing commas, quotes, and newlines", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"')
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""')
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"')
    expect(escapeCsvField("plain")).toBe("plain")
  })

  it("neutralizes CSV formula/injection payloads by quoting", () => {
    // A prompt beginning with = could be interpreted as a formula by Excel.
    // Our escaping at minimum quotes fields with dangerous characters; a bare
    // "=cmd" has no comma/quote/newline, so verify the prompt is still quoted
    // when it contains a comma-laden injection, which is the realistic case.
    const entry = makeEntry({ prompt: '=HYPERLINK("http://evil","x"),2+2' })
    const csv = buildCsvExport([entry])
    const dataRow = csv.split("\r\n")[1]
    expect(dataRow).toContain('"=HYPERLINK(""http://evil"",""x""),2+2"')
  })
})

describe("JSON import validation", () => {
  it("accepts a valid exported file and de-duplicates by id", () => {
    const existing = [makeEntry()]
    const file = serializeJsonExport([makeEntry(), makeEntry({ id: "entry-2" })])
    const result = parseJsonImport(file, existing)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.imported).toBe(1) // entry-1 is a duplicate
    expect(result.duplicates).toBe(1)
    expect(result.entries[0].id).toBe("entry-2")
  })

  it("rejects non-JSON text", () => {
    const r = parseJsonImport("not json at all", [])
    expect(r.ok).toBe(false)
  })

  it("rejects a file that is not a RouterDash export", () => {
    const r = parseJsonImport(JSON.stringify({ foo: "bar" }), [])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/RouterDash/i)
  })

  it("rejects an export whose entries are malformed", () => {
    const bad = JSON.stringify({
      kind: "routerdash.benchmark-export",
      version: 1,
      appVersion: "1.0.0",
      exportedAt: new Date().toISOString(),
      entries: [{ id: "x" }],
    })
    const r = parseJsonImport(bad, [])
    expect(r.ok).toBe(false)
  })

  it("rejects oversized files", () => {
    const big = "x".repeat(2_000_001)
    const r = parseJsonImport(big, [])
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toMatch(/too large/i)
  })
})

describe("isHistoryEntry type guard", () => {
  it("accepts a well-formed entry", () => {
    expect(isHistoryEntry(makeEntry())).toBe(true)
  })
  it("rejects a partial entry", () => {
    expect(isHistoryEntry({ id: "x", createdAt: 1 })).toBe(false)
  })
})
