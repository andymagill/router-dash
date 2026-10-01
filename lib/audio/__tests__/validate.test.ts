import { describe, expect, it } from "vitest"
import {
  MAX_AUDIO_BYTES,
  audioExtension,
  validateAudioFile,
} from "../validate"

const file = (name: string, type: string, size = 1024) => ({ name, type, size })

describe("audioExtension", () => {
  it("lowercases and strips the dot", () => {
    expect(audioExtension("Memo.M4A")).toBe("m4a")
  })
  it("returns empty when there is no extension", () => {
    expect(audioExtension("voicememo")).toBe("")
  })
})

describe("validateAudioFile", () => {
  it("accepts a normal audio MIME type", () => {
    expect(validateAudioFile(file("a.mp3", "audio/mpeg")).ok).toBe(true)
  })

  it("falls back to the extension when the MIME type is empty", () => {
    expect(validateAudioFile(file("memo.m4a", "")).ok).toBe(true)
  })

  it("accepts a video/mp4 container (some phones label m4a that way)", () => {
    expect(validateAudioFile(file("memo.mp4", "video/mp4")).ok).toBe(true)
  })

  it("rejects non-audio files", () => {
    const r = validateAudioFile(file("notes.pdf", "application/pdf"))
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/unsupported/i)
  })

  it("rejects empty files", () => {
    expect(validateAudioFile(file("a.wav", "audio/wav", 0)).ok).toBe(false)
  })

  it("rejects files over the size cap", () => {
    const r = validateAudioFile(
      file("big.wav", "audio/wav", MAX_AUDIO_BYTES + 1),
    )
    expect(r.ok).toBe(false)
    expect(r.reason).toMatch(/25MB/)
  })

  it("accepts a file exactly at the cap", () => {
    expect(
      validateAudioFile(file("edge.wav", "audio/wav", MAX_AUDIO_BYTES)).ok,
    ).toBe(true)
  })
})
