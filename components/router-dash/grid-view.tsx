"use client"

import { cn } from "@/lib/utils"
import { ResultCard } from "@/components/router-dash/result-card"
import type { UnifiedModel } from "@/lib/providers"
import type { RunState } from "@/lib/types"

export const SLOT_LABELS = ["A", "B", "C", "D"]

export function GridView({
  selectedKeys,
  modelByKey,
  results,
}: {
  selectedKeys: string[]
  modelByKey: Map<string, UnifiedModel>
  results: Map<string, RunState>
}) {
  const cols =
    selectedKeys.length >= 3
      ? "lg:grid-cols-2 2xl:grid-cols-4"
      : selectedKeys.length === 2
        ? "lg:grid-cols-2"
        : "lg:grid-cols-1"

  return (
    <div className={cn("grid grid-cols-1 gap-3", cols)}>
      {selectedKeys.map((key, idx) => (
        <ResultCard
          key={key}
          slot={SLOT_LABELS[idx] ?? String(idx + 1)}
          modelKey={key}
          model={modelByKey.get(key)}
          run={results.get(key)}
        />
      ))}
    </div>
  )
}
