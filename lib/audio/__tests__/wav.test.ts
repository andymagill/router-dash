import { describe, expect, it } from "vitest"
import { bytesToBase64, encodeWav } from "../wav"

const ascii = (b: Uint8Array, from: number, len: number) =>
  String.fromCharCode(...b.subarray(from, from + len))

describe("encodeWav", () => {
  it("writes a valid 44-byte PCM16 mono header", () => {
    const wav = encodeWav(new Float32Array(100), 16_000)
    const view = new DataView(wav.buffer)
    expect(ascii(wav, 0, 4)).toBe("RIFF")
    expect(ascii(wav, 8, 4)).toBe("WAVE")
    expect(ascii(wav, 12, 4)).toBe("fmt ")
    expect(view.getUint16(20, true)).toBe(1) // PCM
    expect(view.getUint16(22, true)).toBe(1) // mono
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint32(28, true)).toBe(32_000) // byte rate
    expect(view.getUint16(34, true)).toBe(16)
    expect(ascii(wav, 36, 4)).toBe("data")
    expect(view.getUint32(40, true)).toBe(200)
    expect(view.getUint32(4, true)).toBe(36 + 200)
    expect(wav.length).toBe(44 + 200)
  })

  it("scales and clamps samples to int16", () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2, -2, 0.5]), 16_000)
    const view = new DataView(wav.buffer)
    const sample = (i: number) => view.getInt16(44 + i * 2, true)
    expect(sample(0)).toBe(0)
    expect(sample(1)).toBe(0x7fff)
    expect(sample(2)).toBe(-0x8000)
    expect(sample(3)).toBe(0x7fff) // clamped
    expect(sample(4)).toBe(-0x8000) // clamped
    expect(sample(5)).toBe(Math.trunc(0.5 * 0x7fff))
  })

  it("encodes an empty buffer as a header-only file", () => {
    expect(encodeWav(new Float32Array(0)).length).toBe(44)
  })
})

describe("bytesToBase64", () => {
  it("matches Buffer's base64 for small input", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255])
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"))
  })

  it("handles input larger than one internal chunk", () => {
    const bytes = new Uint8Array(0x8000 * 2 + 17).map((_, i) => i % 251)
    expect(bytesToBase64(bytes)).toBe(Buffer.from(bytes).toString("base64"))
  })
})
