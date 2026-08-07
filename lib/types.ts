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
}

export const HISTORY_LIMIT = 25
