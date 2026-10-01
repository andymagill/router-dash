/**
 * Client-side helpers for validating an uploaded audio file before it is
 * stored and sent to transcription models. Mirrors `lib/images.ts`: a
 * conservative cap on type/size, since the file is kept in IndexedDB and
 * uploaded once per selected model.
 */

/** Container formats both Groq and OpenRouter audio models generally accept. */
export const ALLOWED_AUDIO_EXTENSIONS = [
  "mp3",
  "wav",
  "m4a",
  "mp4",
  "webm",
  "ogg",
  "flac",
] as const

/** Groq's free-tier upload limit; also keeps base64 payloads to OpenRouter sane. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024
/** Keeps a single run (and the model bill for it) bounded. */
export const MAX_AUDIO_SECONDS = 10 * 60

export interface AudioValidationResult {
  ok: boolean
  /** Why the file was rejected; set only when `ok` is false. */
  reason?: string
}

/** Lowercased extension without the dot, or "" when there is none. */
export function audioExtension(name: string): string {
  const idx = name.lastIndexOf(".")
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ""
}

/**
 * Accept by MIME type first and fall back to the extension, because some
 * mobile file pickers report an empty `type` for voice memos.
 */
export function validateAudioFile(file: {
  name: string
  type: string
  size: number
}): AudioValidationResult {
  const ext = audioExtension(file.name)
  const typeOk = file.type.startsWith("audio/") || file.type === "video/mp4"
  const extOk = (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext)
  if (!typeOk && !extOk) {
    return { ok: false, reason: "Unsupported file type — use an audio file" }
  }
  if (file.size === 0) {
    return { ok: false, reason: "File is empty" }
  }
  if (file.size > MAX_AUDIO_BYTES) {
    return {
      ok: false,
      reason: `Larger than ${MAX_AUDIO_BYTES / (1024 * 1024)}MB`,
    }
  }
  return { ok: true }
}

/** Duration in ms via a detached <audio> element; rejects if undecodable. */
export function readAudioDurationMs(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const el = new Audio()
    const done = () => {
      el.removeAttribute("src")
      URL.revokeObjectURL(url)
    }
    el.preload = "metadata"
    el.onloadedmetadata = () => {
      const seconds = el.duration
      done()
      if (!Number.isFinite(seconds)) {
        reject(new Error("Could not read audio length"))
        return
      }
      resolve(Math.round(seconds * 1000))
    }
    el.onerror = () => {
      done()
      reject(new Error("This browser can't read that audio file"))
    }
    el.src = url
  })
}
