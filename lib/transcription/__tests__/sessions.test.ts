import { describe, expect, it } from "vitest"
import {
  createSession,
  enforceLimit,
  mergeResults,
  parseSessions,
  realtimeFactor,
  wordCount,
} from "../sessions"
import type { TranscriptResult, TranscriptionSession } from "../types"

const result = (modelKey: string, text = "hi"): TranscriptResult => ({
  modelKey,
  status: "done",
  text,
  latencyMs: 100,
  usage: null,
  cost: 0,
  runAt: 1,
})

const session = (
  id: string,
  extra: Partial<TranscriptionSession> = {},
): TranscriptionSession => ({
  id,
  createdAt: 1,
  fileName: `${id}.mp3`,
  mimeType: "audio/mpeg",
  sizeBytes: 10,
  durationMs: 1000,
  results: [],
  ...extra,
})

describe("createSession", () => {
  it("copies file metadata and starts with no results", () => {
    const s = createSession(
      {
        blob: new Blob(["x"]),
        fileName: "a.mp3",
        mimeType: "audio/mpeg",
        durationMs: 5000,
        sizeBytes: 1,
      },
      "",
      42,
    )
    expect(s.createdAt).toBe(42)
    expect(s.fileName).toBe("a.mp3")
    expect(s.language).toBeUndefined()
    expect(s.results).toEqual([])
  })
})

describe("mergeResults", () => {
  it("replaces the same model's earlier result and keeps others", () => {
    const base = session("s", {
      results: [result("groq:a", "old"), result("groq:b", "keep")],
    })
    const merged = mergeResults(base, [
      result("groq:a", "new"),
      result("openrouter:c"),
    ])
    expect(merged.results.map((r) => [r.modelKey, r.text])).toEqual([
      ["groq:a", "new"],
      ["groq:b", "keep"],
      ["openrouter:c", "hi"],
    ])
  })

  it("does not mutate the input session", () => {
    const base = session("s", { results: [result("groq:a")] })
    mergeResults(base, [result("groq:b")])
    expect(base.results).toHaveLength(1)
  })
})

describe("enforceLimit", () => {
  it("evicts the oldest unpinned sessions beyond the limit", () => {
    const list = [session("1"), session("2"), session("3"), session("4")]
    const { kept, evicted } = enforceLimit(list, 2)
    expect(kept.map((s) => s.id)).toEqual(["1", "2"])
    expect(evicted.map((s) => s.id)).toEqual(["3", "4"])
  })

  it("never evicts pinned sessions, and they use up room", () => {
    const list = [
      session("1"),
      session("2", { pinned: true }),
      session("3"),
      session("4", { pinned: true }),
    ]
    const { kept, evicted } = enforceLimit(list, 3)
    expect(kept.map((s) => s.id).sort()).toEqual(["1", "2", "4"])
    expect(evicted.map((s) => s.id)).toEqual(["3"])
  })

  it("keeps every pinned session even if they exceed the limit", () => {
    const list = [
      session("1", { pinned: true }),
      session("2", { pinned: true }),
    ]
    const { kept, evicted } = enforceLimit(list, 1)
    expect(kept).toHaveLength(2)
    expect(evicted).toEqual([])
  })
})

describe("parseSessions", () => {
  it("returns [] for non-arrays", () => {
    expect(parseSessions(null)).toEqual([])
    expect(parseSessions({})).toEqual([])
  })

  it("drops malformed entries and keeps valid ones", () => {
    const parsed = parseSessions([
      null,
      { id: 1 },
      {
        id: "ok",
        fileName: "a.mp3",
        results: [
          { modelKey: "groq:a", text: "t", status: "done" },
          { nope: true },
        ],
      },
    ])
    expect(parsed).toHaveLength(1)
    expect(parsed[0].results).toHaveLength(1)
    expect(parsed[0].results[0].text).toBe("t")
  })

  it("turns a result stuck in 'running' into an interrupted error", () => {
    const [s] = parseSessions([
      {
        id: "x",
        fileName: "a.mp3",
        results: [{ modelKey: "groq:a", status: "running" }],
      },
    ])
    expect(s.results[0].status).toBe("error")
    expect(s.results[0].error).toBe("Interrupted")
  })
})

describe("metrics", () => {
  it("computes the real-time factor", () => {
    expect(realtimeFactor(2000, 10_000)).toBe(0.2)
    expect(realtimeFactor(0, 10_000)).toBeNull()
    expect(realtimeFactor(2000, 0)).toBeNull()
  })

  it("counts words", () => {
    expect(wordCount("  hello   brave new world ")).toBe(4)
    expect(wordCount("   ")).toBe(0)
  })
})
