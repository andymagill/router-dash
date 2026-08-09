import type { ORUsage, RunParams } from "@/lib/openrouter"

export type RunStatus = "idle" | "running" | "done" | "error"

export interface RunState {
  modelId: string
  status: RunStatus
  content: string
  error?: string
  usage: ORUsage | null
  cost: number
  latencyMs: number
}

export type ViewMode = "grid" | "diff"

export interface HistoryEntry {
  id: string
  createdAt: number
  prompt: string
  params: RunParams
  modelIds: string[]
  results: RunState[]
  elapsedMs: number
  totalCost: number
  /** Pinned entries are kept at the top and are never evicted by the limit. */
  pinned?: boolean
}

export const HISTORY_LIMIT = 25

/** App version surfaced in exports and feedback diagnostics. */
export const APP_VERSION = "1.0.0"

/** GitHub repository used for feedback issue links. */
export const GITHUB_REPO = "andymagill/router-dash"
