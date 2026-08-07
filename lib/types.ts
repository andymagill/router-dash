import type { ORUsage } from "@/lib/openrouter"

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
