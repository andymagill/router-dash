import type { RunParams } from "@/lib/providers/types"
import { type PromptPreset } from "@/lib/presets"

/** Run params a saved prompt restores. `systemPrompt` is stored separately as
 *  `system` so a SavedPrompt stays shape-compatible with a built-in PromptPreset. */
export type SavedParams = Omit<RunParams, "systemPrompt">

export interface SavedPrompt extends PromptPreset {
  params: SavedParams
  createdAt: number
}

/** A row in the library: either a built-in preset or one the user saved. */
export type LibraryItem = PromptPreset | SavedPrompt

export const MAX_SAVED_PROMPTS = 100

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `user-${crypto.randomUUID()}`
  }
  return `user-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function createSavedPrompt(input: {
  label: string
  description: string
  prompt: string
  system: string
  params: SavedParams
}): SavedPrompt {
  return {
    id: genId(),
    label: input.label.trim(),
    description: input.description.trim(),
    prompt: input.prompt,
    system: input.system,
    params: input.params,
    createdAt: Date.now(),
  }
}

/** Case-insensitive match across label, description, prompt, and system text.
 *  An empty/whitespace query is a passthrough — no filtering. */
export function filterLibrary<T extends PromptPreset>(
  items: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) =>
    [item.label, item.description, item.prompt, item.system]
      .join("\n")
      .toLowerCase()
      .includes(q),
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

/** Defensive normalization of whatever came out of localStorage — a
 *  hand-edited or partially-written value must not crash the library dialog. */
export function parseSavedPrompts(raw: unknown): SavedPrompt[] {
  if (!Array.isArray(raw)) return []
  const out: SavedPrompt[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const { id, label, prompt } = entry
    if (typeof id !== "string" || !id) continue
    if (typeof label !== "string" || !label) continue
    if (typeof prompt !== "string") continue
    const description = typeof entry.description === "string" ? entry.description : ""
    const system = typeof entry.system === "string" ? entry.system : ""
    const createdAt = typeof entry.createdAt === "number" ? entry.createdAt : Date.now()
    const rawParams = isRecord(entry.params) ? entry.params : {}
    const params: SavedParams = {
      temperature:
        typeof rawParams.temperature === "number" ? rawParams.temperature : 1,
      topP: typeof rawParams.topP === "number" ? rawParams.topP : 1,
      maxTokens:
        typeof rawParams.maxTokens === "number" ? rawParams.maxTokens : 1024,
    }
    out.push({ id, label, description, prompt, system, params, createdAt })
    if (out.length >= MAX_SAVED_PROMPTS) break
  }
  return out
}

/** Prefill for the save dialog's name field: the first non-empty line,
 *  whitespace-collapsed and truncated. */
export function defaultPromptName(prompt: string): string {
  const line = prompt
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!line) return ""
  const collapsed = line.replace(/\s+/g, " ")
  return collapsed.length > 60 ? `${collapsed.slice(0, 59)}…` : collapsed
}
