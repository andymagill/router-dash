/**
 * Small, generic capability rules used to keep clearly-incompatible models out
 * of the text/chat benchmark path (which would otherwise produce predictable
 * invalid requests), plus vendor-slug normalization for the monogram badge.
 */

/**
 * Model IDs matching these fragments are not usable via chat-completions
 * (transcription, TTS, safety-only guards, embeddings, moderation). Excluding
 * them prevents guaranteed-invalid benchmark requests. This is intentionally
 * conservative — it only targets well-known non-chat families.
 */
const INCOMPATIBLE_ID_MATCHERS = [
  "whisper",
  "-tts",
  "tts-",
  "playai-tts",
  "text-to-speech",
  "-guard",
  "guard-",
  "prompt-guard",
  "llama-guard",
  "embed", // embedding / text-embedding
  "moderation",
]

/** True when a model ID looks usable with the chat-completion benchmark path. */
export function isChatCompatibleId(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return !INCOMPATIBLE_ID_MATCHERS.some((m) => id.includes(m))
}

/** Known owner strings (Groq `owned_by`) → monogram vendor slugs. */
const OWNER_TO_SLUG: Record<string, string> = {
  meta: "meta",
  "meta-llama": "meta-llama",
  google: "google",
  openai: "openai",
  "mistral ai": "mistralai",
  mistralai: "mistralai",
  mistral: "mistralai",
  deepseek: "deepseek",
  "alibaba cloud": "qwen",
  alibaba: "qwen",
  qwen: "qwen",
  anthropic: "anthropic",
  groq: "groq",
  "sdaia": "sdaia",
  moonshotai: "moonshotai",
}

/** Normalize a provider-reported owner into a monogram vendor slug. */
export function vendorSlugFromOwner(owner: string | undefined): string {
  if (!owner) return "unknown"
  const key = owner.trim().toLowerCase()
  return OWNER_TO_SLUG[key] ?? key.split(/[\s/]+/)[0] ?? "unknown"
}

/** Vendor slug from an OpenRouter-style "vendor/model" id. */
export function vendorSlugFromId(modelId: string): string {
  return modelId.split("/")[0] ?? "unknown"
}
