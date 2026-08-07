"use client"

import { cn } from "@/lib/utils"
import { ResultCard } from "@/components/router-dash/result-card"
import type { ORModel } from "@/lib/openrouter"
import type { RunState } from "@/lib/types"

export const SLOT_LABELS = ["A", "B", "C", "D"]

export function GridView({
  selectedIds,
  modelById,
  results,
}: {
  selectedIds: string[]
  modelById: Map<string, ORModel>
  results: Map<string, RunState>
}) {
  const cols =
    selectedIds.length >= 3
      ? "lg:grid-cols-2 2xl:grid-cols-4"
      : selectedIds.length === 2
        ? "lg:grid-cols-2"
        : "lg:grid-cols-1"

  return (
    <div className={cn("grid grid-cols-1 gap-3", cols)}>
      {selectedIds.map((id, idx) => (
        <ResultCard
          key={id}
          slot={SLOT_LABELS[idx] ?? String(idx + 1)}
          modelId={id}
          model={modelById.get(id)}
          run={results.get(id)}
        />
      ))}
    </div>
  )
}
