/**
 * WAV encoding. Used only when an OpenRouter audio model can't take the
 * original container: we decode in the browser, downmix/resample to 16 kHz
 * mono, and send PCM16 WAV (which every OpenRouter audio model accepts).
 */

export const WAV_SAMPLE_RATE = 16_000

/** Encode mono Float32 samples (-1..1) as a 16-bit PCM WAV file. Pure. */
export function encodeWav(
  samples: Float32Array,
  sampleRate: number = WAV_SAMPLE_RATE,
): Uint8Array {
  const dataBytes = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i))
    }
  }

  writeAscii(0, "RIFF")
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(8, "WAVE")
  writeAscii(12, "fmt ")
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeAscii(36, "data")
  view.setUint32(40, dataBytes, true)

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Uint8Array(buffer)
}

/** Standard base64 of raw bytes, chunked to avoid call-stack limits. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Decode any browser-supported audio blob to 16 kHz mono PCM16 WAV bytes. */
export async function blobToWav16k(blob: Blob): Promise<Uint8Array> {
  const encoded = await blob.arrayBuffer()
  // A throwaway context only to decode; its own sample rate is irrelevant.
  const decodeCtx = new AudioContext()
  let decoded: AudioBuffer
  try {
    decoded = await decodeCtx.decodeAudioData(encoded)
  } finally {
    void decodeCtx.close()
  }

  // OfflineAudioContext resamples and downmixes to mono in one pass.
  const frames = Math.max(1, Math.ceil(decoded.duration * WAV_SAMPLE_RATE))
  const offline = new OfflineAudioContext(1, frames, WAV_SAMPLE_RATE)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()
  return encodeWav(rendered.getChannelData(0), WAV_SAMPLE_RATE)
}
